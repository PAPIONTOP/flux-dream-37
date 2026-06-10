/**
 * Reads & validates required env vars. Call inside server-only handlers,
 * not at module scope of client-reachable files.
 */
export interface RuntimeConfig {
  tmdbApiKey: string;
  apiKey: string;
  adminKey: string;
  jwtSecret: string;
  source: {
    baseUrl: string;
    moviePath: string;
    seriesPath: string;
    userAgent: string;
    cookies: string;
  };
  streamCacheTtl: number;
  proxyTokenTtl: number;
  scraperConcurrency: number;
}

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v == null || v === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export function getConfig(): RuntimeConfig {
  return {
    tmdbApiKey: req("TMDB_API_KEY"),
    apiKey: req("API_KEY"),
    adminKey: req("ADMIN_KEY"),
    jwtSecret: req("JWT_SECRET"),
    source: {
      baseUrl: req("SOURCE_BASE_URL").replace(/\/$/, ""),
      moviePath: req("SOURCE_MOVIE_PATH", "/film/{slug}"),
      seriesPath: req(
        "SOURCE_SERIES_PATH",
        "/serie/{slug}/saison-{season}/episode-{episode}",
      ),
      userAgent: req(
        "SOURCE_USER_AGENT",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      ),
      cookies: process.env.SOURCE_COOKIES ?? "",
    },
    streamCacheTtl: Number(process.env.STREAM_CACHE_TTL ?? 7200),
    proxyTokenTtl: Number(process.env.PROXY_TOKEN_TTL ?? 14400),
    scraperConcurrency: Number(process.env.SCRAPER_CONCURRENCY ?? 3),
  };
}

/** Soft check — returns null if config is incomplete instead of throwing. */
export function tryGetConfig(): RuntimeConfig | null {
  try {
    return getConfig();
  } catch {
    return null;
  }
}
