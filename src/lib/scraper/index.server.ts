/**
 * Scraper orchestrator. Resolves a TMDB id to a source slug, fetches the
 * page, walks iframes, and runs the matching provider extractor.
 */
import { getConfig } from "../config.server";
import { logger } from "../logger";
import { ApiError } from "../api/errors";
import { mapping } from "../db/mapping.server";
import { lock } from "../db/lock.server";
import { kv } from "../cache/kv.server";
import { K, TTL } from "../cache/keys";
import { slugify } from "../tmdb/slug";
import { tmdb } from "../tmdb/client";
import { fetchPage, fetchCinepulseLinks, verifyStream } from "./fetch.server";
import { FALLBACK_PROVIDER, pickProvider } from "./resolver.server";
import type { StreamResult } from "./providers/_common";

const MAX_IFRAME_DEPTH = 3;

interface ResolveOpts {
  tmdbId: number;
  mediaType: "movie" | "tv";
  season?: number;
  episode?: number;
  lang: string;
  title?: string; // fallback if no mapping
  forceRefresh?: boolean;
}

interface ResolvedStream extends StreamResult {
  fetchedAt: string;
}

/** Build the source page URL from config template + slug. */
function buildPageUrl(
  slug: string,
  mediaType: "movie" | "tv",
  season?: number,
  episode?: number,
): string {
  const cfg = getConfig();
  const tpl = mediaType === "movie" ? cfg.source.moviePath : cfg.source.seriesPath;
  const path = tpl
    .replace("{slug}", slug)
    .replace("{season}", String(season ?? 1))
    .replace("{episode}", String(episode ?? 1));
  // Tolerate templates that already contain a full URL.
  if (/^https?:\/\//i.test(path)) return path;
  return cfg.source.baseUrl + (path.startsWith("/") ? path : "/" + path);
}

async function resolveSlug(opts: ResolveOpts): Promise<string> {
  const cached = await kv.get<string>(K.sourceSlug(opts.tmdbId, opts.mediaType));
  if (cached) return cached;
  const fromDb = await mapping.get(opts.tmdbId, opts.mediaType);
  if (fromDb) {
    await kv.set(K.sourceSlug(opts.tmdbId, opts.mediaType), fromDb, TTL.SOURCE_SLUG);
    return fromDb;
  }
  // Fall back to TMDB title -> slug.
  let title = opts.title;
  if (!title) {
    if (opts.mediaType === "movie") {
      const m = await tmdb.getMovie(opts.tmdbId);
      title = m.title || m.original_title;
    } else {
      const t = await tmdb.getTv(opts.tmdbId);
      title = t.name || t.original_name;
    }
  }
  if (!title) throw new ApiError("SOURCE_NOT_FOUND", "Cannot derive a slug");
  const slug = slugify(title);
  await mapping.upsert(opts.tmdbId, opts.mediaType, slug);
  await kv.set(K.sourceSlug(opts.tmdbId, opts.mediaType), slug, TTL.SOURCE_SLUG);
  return slug;
}

async function walkAndExtract(
  url: string,
  lang: string,
  depth = 0,
): Promise<StreamResult | null> {
  const cfg = getConfig();
  if (depth > MAX_IFRAME_DEPTH) return null;

  // Cinepulse uses Livewire — bypass static HTML parsing
  if (depth === 0 && /cinepulse\.live/i.test(url)) {
    logger.info("scrape_cinepulse_livewire", { url, lang });
    const links = await fetchCinepulseLinks(url, cfg.source.userAgent, lang);
    logger.info("scrape_cinepulse_links", { count: links.length, links });
    for (const link of links) {
      logger.debug("scrape_cinepulse_try", { link });
      try {
        const provider = pickProvider(link);
        const result = await provider.extract({
          pageUrl: link,
          lang,
          userAgent: cfg.source.userAgent,
          cookies: cfg.source.cookies,
        });
        if (result) return result;
      } catch (e) {
        logger.warn("scrape_cinepulse_provider_err", { link, err: String(e) });
      }
      const nested = await walkAndExtract(link, lang, depth + 1);
      if (nested) return nested;
    }
    return null;
  }

  logger.info("scrape_fetch", { url, depth });
  const page = await fetchPage(url, cfg.source.userAgent, cfg.source.cookies);
  if (page.status >= 400) {
    logger.warn("scrape_fetch_status", { url, status: page.status });
    if (depth === 0) throw new ApiError("SOURCE_NOT_FOUND", `Source returned ${page.status}`);
    return null;
  }

  // Try direct provider on the current HTML first (cheapest).
  const directHit = await FALLBACK_PROVIDER.extract({
    pageUrl: url,
    html: page.html,
    lang,
    userAgent: cfg.source.userAgent,
    cookies: cfg.source.cookies,
  });
  if (directHit) return directHit;

  // Then walk iframes.
  for (const ifr of page.iframes) {
    const provider = pickProvider(ifr);
    logger.debug("scrape_iframe", { iframe: ifr, provider: provider.name });
    try {
      const result = await provider.extract({
        pageUrl: ifr,
        lang,
        userAgent: cfg.source.userAgent,
        cookies: cfg.source.cookies,
      });
      if (result) return result;
    } catch (e) {
      logger.warn("scrape_provider_err", { iframe: ifr, err: String(e) });
    }
    // If provider failed, recurse into the iframe page itself (it may
    // contain nested iframes).
    const nested = await walkAndExtract(ifr, lang, depth + 1);
    if (nested) return nested;
  }
  return null;
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: unknown;
  const delays = [0, 1000, 3000];
  for (const d of delays) {
    if (d) await new Promise((r) => setTimeout(r, d));
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      logger.warn("scrape_retry", { label, err: String(e) });
    }
  }
  throw lastErr;
}

/** Main entry. */
export async function getStream(opts: ResolveOpts): Promise<ResolvedStream> {
  const cfg = getConfig();
  const cacheKey =
    opts.mediaType === "movie"
      ? K.streamMovie(opts.tmdbId, opts.lang)
      : K.streamTv(opts.tmdbId, opts.season ?? 1, opts.episode ?? 1, opts.lang);

  if (!opts.forceRefresh) {
    const hit = await kv.get<ResolvedStream>(cacheKey);
    if (hit) {
      logger.info("scrape_cache_hit", { cacheKey });
      return hit;
    }
  }

  const lockKey = K.scraperLock(opts.tmdbId);
  const got = await lock.acquire(lockKey, TTL.LOCK);
  if (!got) {
    throw new ApiError("SCRAPER_BUSY", "Another scrape is already running for this content");
  }

  try {
    const slug = await resolveSlug(opts);
    const pageUrl = buildPageUrl(slug, opts.mediaType, opts.season, opts.episode);
    const result = await withRetry(
      () => walkAndExtract(pageUrl, opts.lang),
      "walkAndExtract",
    );
    if (!result) throw new ApiError("NO_STREAM_FOUND", `No stream detected at ${pageUrl}`);

    const ok = await verifyStream(result.streamUrl, cfg.source.userAgent, pageUrl);
    if (!ok) throw new ApiError("STREAM_INVALID", `Stream URL not reachable: ${result.streamUrl}`);

    const final: ResolvedStream = { ...result, fetchedAt: new Date().toISOString() };
    await kv.set(cacheKey, final, cfg.streamCacheTtl);
    return final;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError("SCRAPE_FAILED", e instanceof Error ? e.message : String(e));
  } finally {
    await lock.release(lockKey);
  }
}

/** Admin/test helper: extract from an arbitrary URL. */
export async function testExtract(url: string): Promise<StreamResult | null> {
  return walkAndExtract(url, "vf", 0);
}
