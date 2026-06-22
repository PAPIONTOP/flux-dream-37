import { createServerFn } from "@tanstack/react-start";

import { z } from "zod";
import { tmdb } from "@/lib/tmdb/client";
import { getStream } from "@/lib/scraper/index.server";
import { signProxyToken } from "@/lib/proxy/token.server";

const Input = z.object({
  tmdbId: z.number().int().positive(),
  mediaType: z.enum(["movie", "tv"]),
  season: z.number().int().positive().optional(),
  episode: z.number().int().positive().optional(),
  lang: z.enum(["vf", "fr", "vostfr", "en"]).default("vf"),
  forceRefresh: z.boolean().default(false),
});

export const scrapeStream = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    let title: string | undefined;
    let poster: string | null = null;
    let displayTitle = "";
    try {
      if (data.mediaType === "movie") {
        const m = await tmdb.getMovie(data.tmdbId);
        title = m.title || m.original_title;
        displayTitle = title ?? "";
        poster = tmdb.posterUrl(m.poster_path);
      } else {
        const t = await tmdb.getTv(data.tmdbId);
        title = t.name || t.original_name;
        displayTitle = title ?? "";
        poster = tmdb.posterUrl(t.poster_path);
      }
    } catch {
      // TMDB lookup failure isn't fatal — scraper can still try with slug from DB.
    }
    try {
      const stream = await getStream({
        tmdbId: data.tmdbId,
        mediaType: data.mediaType,
        season: data.season,
        episode: data.episode,
        lang: data.lang,
        title,
        forceRefresh: data.forceRefresh,
      });
      const proxyToken = await signProxyToken({
        u: stream.streamUrl,
        r: stream.referer,
        p: stream.provider,
      });
      // Relative URL — the browser resolves it against its own origin.
      const proxyUrl = `/api/public/v1/proxy/${proxyToken.token}/index.m3u8`;
      return {
        ok: true as const,
        title: displayTitle,
        poster,
        stream: {
          ...stream,
          proxyUrl,
          proxyExpiresAt: proxyToken.expiresAt,
        },
      };
    } catch (e) {
      const err = e as { code?: string; message?: string };
      return {
        ok: false as const,
        title: displayTitle,
        poster,
        error: {
          code: err.code ?? "ERROR",
          message: err.message ?? String(e),
        },
      };
    }
  });
