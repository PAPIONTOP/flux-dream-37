import { ApiError } from "../api/errors";
import { getConfig } from "../config.server";
import { logger } from "../logger";

const BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/w500";

export interface TmdbMovie {
  id: number;
  title: string;
  original_title: string;
  release_date: string;
  poster_path: string | null;
  runtime: number | null;
  overview: string;
}

export interface TmdbTv {
  id: number;
  name: string;
  original_name: string;
  first_air_date: string;
  poster_path: string | null;
  number_of_seasons: number;
  number_of_episodes: number;
  seasons: Array<{
    season_number: number;
    episode_count: number;
    name: string;
    air_date: string | null;
  }>;
  overview: string;
}

async function tmdbFetch<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const cfg = getConfig();
  const url = new URL(BASE + path);
  url.searchParams.set("api_key", cfg.tmdbApiKey);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    logger.error("tmdb_fetch_failed", { path, err: String(e) });
    throw new ApiError("TMDB_API_ERROR", `TMDB request failed: ${String(e)}`);
  }
  if (res.status === 404) {
    throw new ApiError("TMDB_NOT_FOUND", `TMDB ${path} not found`);
  }
  if (!res.ok) {
    throw new ApiError("TMDB_API_ERROR", `TMDB ${path} returned ${res.status}`);
  }
  return (await res.json()) as T;
}

export const tmdb = {
  posterUrl(p: string | null): string | null {
    return p ? `${IMG}${p}` : null;
  },
  async getMovie(id: number, lang = "fr-FR"): Promise<TmdbMovie> {
    return tmdbFetch<TmdbMovie>(`/movie/${id}`, { language: lang });
  },
  async getTv(id: number, lang = "fr-FR"): Promise<TmdbTv> {
    return tmdbFetch<TmdbTv>(`/tv/${id}`, { language: lang });
  },
  async searchMovie(query: string, year?: number, lang = "fr-FR") {
    return tmdbFetch<{ results: TmdbMovie[]; total_results: number }>(
      `/search/movie`,
      { query, language: lang, ...(year ? { year } : {}) },
    );
  },
  async searchTv(query: string, lang = "fr-FR") {
    return tmdbFetch<{ results: TmdbTv[]; total_results: number }>(`/search/tv`, {
      query,
      language: lang,
    });
  },
};
