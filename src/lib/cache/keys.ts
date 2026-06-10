/** Centralised Redis-style key naming + TTLs (seconds). */
export const TTL = {
  TMDB_META: 86400,
  TMDB_SEARCH: 21600,
  SOURCE_SLUG: 604800,
  LOCK: 30,
} as const;

export const K = {
  streamMovie: (tmdbId: number, lang: string) => `stream:movie:${tmdbId}:${lang}`,
  streamTv: (tmdbId: number, s: number, e: number, lang: string) =>
    `stream:tv:${tmdbId}:s${s}e${e}:${lang}`,
  tmdbMovie: (tmdbId: number) => `tmdb:movie:${tmdbId}`,
  tmdbTv: (tmdbId: number) => `tmdb:tv:${tmdbId}`,
  tmdbSearch: (hash: string) => `tmdb:search:${hash}`,
  sourceSlug: (tmdbId: number, type: "movie" | "tv") =>
    `source:slug:${type}:${tmdbId}`,
  scraperLock: (tmdbId: number) => `scraper:lock:${tmdbId}`,
} as const;

export function hashQuery(input: string): string {
  // Tiny non-crypto string hash (FNV-1a-ish) — good enough for cache keys.
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h.toString(16);
}
