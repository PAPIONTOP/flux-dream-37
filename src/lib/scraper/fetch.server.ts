/**
 * Page fetcher + iframe discovery via cheerio.
 */
import * as cheerio from "cheerio";
import { fetchHtml } from "./providers/_common";

export interface PageInfo {
  status: number;
  html: string;
  finalUrl: string;
  iframes: string[];
}

export async function fetchPage(
  url: string,
  userAgent: string,
  cookies: string,
): Promise<PageInfo> {
  const r = await fetchHtml(url, userAgent, cookies, 7000);
  const iframes: string[] = [];
  if (r.status < 400 && r.html) {
    const $ = cheerio.load(r.html);
    $("iframe[src]").each((_, el) => {
      const src = $(el).attr("src");
      if (src) iframes.push(absolutize(src, r.finalUrl));
    });
    // Some sites use data-src
    $("iframe[data-src]").each((_, el) => {
      const src = $(el).attr("data-src");
      if (src) iframes.push(absolutize(src, r.finalUrl));
    });
  }
  return { status: r.status, html: r.html, finalUrl: r.finalUrl, iframes };
}

function absolutize(src: string, base: string): string {
  try {
    return new URL(src, base).toString();
  } catch {
    return src;
  }
}

/** Verify a stream URL is reachable (HEAD then GET range fallback). */
export async function verifyStream(
  url: string,
  userAgent: string,
  referer?: string,
): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: {
        "user-agent": userAgent,
        ...(referer ? { referer } : {}),
      },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 200 || res.status === 206) return true;
    // Some CDNs don't support HEAD — try a range GET.
    if (res.status === 405 || res.status === 403) {
      const res2 = await fetch(url, {
        method: "GET",
        headers: {
          "user-agent": userAgent,
          range: "bytes=0-1",
          ...(referer ? { referer } : {}),
        },
        signal: AbortSignal.timeout(5000),
      });
      return res2.status === 200 || res2.status === 206;
    }
    return false;
  } catch {
    return false;
  }
}

/** Recursively unwrap Livewire snapshot tuples like [value, {s:"arr"}]. */
function unwrapLivewire(v: unknown): unknown {
  if (
    Array.isArray(v) &&
    v.length === 2 &&
    v[1] &&
    typeof v[1] === "object" &&
    ((v[1] as Record<string, unknown>).s === "arr" ||
      (v[1] as Record<string, unknown>).s === "mdl")
  ) {
    return unwrapLivewire(v[0]);
  }
  if (Array.isArray(v)) return v.map(unwrapLivewire);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>)) {
      out[k] = unwrapLivewire((v as Record<string, unknown>)[k]);
    }
    return out;
  }
  return v;
}

interface CinepulseVideo {
  server_name?: string;
  label?: string;
  version?: string;
  embed_type?: string;
  type?: string;
  link?: string;
}

export async function fetchCinepulseLinks(
  pageUrl: string,
  userAgent: string,
  lang: string,
): Promise<string[]> {
  const page = await fetchHtml(pageUrl, userAgent, "", 10000);
  if (page.status >= 400) return [];
  const $ = cheerio.load(page.html);
  let snapshot = "";
  $("[wire\\:snapshot]").each((_, el) => {
    const snap = $(el).attr("wire:snapshot") ?? "";
    if (snap.includes("watch-component")) snapshot = snap;
  });
  if (!snapshot) return [];

  try {
    const snapData = JSON.parse(snapshot) as { data?: { videos?: unknown } };
    const unwrapped = unwrapLivewire(snapData.data?.videos) as unknown;
    // After unwrapping, videos is a (possibly nested) array of video objects.
    const flat: CinepulseVideo[] = [];
    const collect = (v: unknown) => {
      if (Array.isArray(v)) {
        for (const item of v) collect(item);
      } else if (v && typeof v === "object" && "link" in (v as object)) {
        flat.push(v as CinepulseVideo);
      }
    };
    collect(unwrapped);

    const langMap: Record<string, string[]> = {
      vf: ["VF", "FRENCH", "TRUEFRENCH"],
      fr: ["FRENCH", "TRUEFRENCH", "VF"],
      vostfr: ["VOSTFR"],
      en: ["VOSTFR", "TRUEFRENCH"],
    };
    const versions =
      langMap[lang.toLowerCase()] ?? ["VF", "FRENCH", "TRUEFRENCH", "VOSTFR"];

    // Sort so preferred versions come first, keep original order otherwise.
    const matched = flat
      .filter((v) => versions.includes((v.version ?? "").toUpperCase()))
      .sort(
        (a, b) =>
          versions.indexOf((a.version ?? "").toUpperCase()) -
          versions.indexOf((b.version ?? "").toUpperCase()),
      )
      .map((v) => v.link!)
      .filter(Boolean);

    return [...new Set(matched)];
  } catch {
    return [];
  }
}
