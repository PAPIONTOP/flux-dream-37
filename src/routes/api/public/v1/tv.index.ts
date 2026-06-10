import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireApiKey } from "@/lib/api/auth";
import { handle, ApiError } from "@/lib/api/errors";
import { tmdb } from "@/lib/tmdb/client";
import { getStream } from "@/lib/scraper/index.server";
import { signProxyToken } from "@/lib/proxy/token.server";
import { getConfig } from "@/lib/config.server";

const QuerySchema = z.object({
  tmdb_id: z.coerce.number().int().positive().optional(),
  title: z.string().min(1).optional(),
  season: z.coerce.number().int().positive().optional(),
  episode: z.coerce.number().int().positive().optional(),
  lang: z.enum(["fr", "vf", "vostfr", "en"]).default("vf"),
  mode: z.enum(["url", "proxy"]).default("url"),
  force_refresh: z.coerce.boolean().default(false),
});

export const Route = createFileRoute("/api/public/v1/tv/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const instance = url.pathname + url.search;
        try {
          requireApiKey(request);
          const params = QuerySchema.parse(
            Object.fromEntries(url.searchParams.entries()),
          );
          if (!params.tmdb_id && !params.title) {
            throw new ApiError("BAD_REQUEST", "tmdb_id or title is required");
          }

          let tmdbId = params.tmdb_id;
          if (!tmdbId && params.title) {
            const r = await tmdb.searchTv(params.title);
            if (!r.results.length) {
              throw new ApiError("TMDB_NOT_FOUND", `No TMDB match for "${params.title}"`);
            }
            tmdbId = r.results[0].id;
          }
          if (!tmdbId) throw new ApiError("BAD_REQUEST", "Could not resolve TMDB id");

          const meta = await tmdb.getTv(tmdbId);

          // Without season+episode → return the structure of the show.
          if (!params.season || !params.episode) {
            return Response.json({
              tmdb_id: meta.id,
              title: meta.name,
              year: meta.first_air_date ? Number(meta.first_air_date.slice(0, 4)) : null,
              poster: tmdb.posterUrl(meta.poster_path),
              number_of_seasons: meta.number_of_seasons,
              number_of_episodes: meta.number_of_episodes,
              seasons: meta.seasons.map((s) => ({
                season_number: s.season_number,
                episode_count: s.episode_count,
                name: s.name,
                air_date: s.air_date,
              })),
            });
          }

          const stream = await getStream({
            tmdbId,
            mediaType: "tv",
            season: params.season,
            episode: params.episode,
            lang: params.lang,
            title: meta.name || meta.original_name,
            forceRefresh: params.force_refresh,
          });

          const cfg = getConfig();
          const proxyBase = `${url.origin}/api/public/v1/proxy`;
          let proxyUrl: string | undefined;
          let expiresAt: string | undefined;
          if (params.mode === "proxy") {
            const t = await signProxyToken({ u: stream.streamUrl, p: stream.provider });
            proxyUrl = `${proxyBase}/${t.token}/index.m3u8`;
            expiresAt = t.expiresAt;
          } else {
            expiresAt = new Date(Date.now() + cfg.proxyTokenTtl * 1000).toISOString();
          }

          return Response.json({
            tmdb_id: meta.id,
            title: meta.name,
            season: params.season,
            episode: params.episode,
            poster: tmdb.posterUrl(meta.poster_path),
            streams: [
              {
                lang: stream.lang,
                quality: stream.quality,
                provider: stream.provider,
                type: stream.type,
                ...(params.mode === "url" ? { stream_url: stream.streamUrl } : {}),
                ...(params.mode === "proxy" ? { proxy_url: proxyUrl } : {}),
                expires_at: expiresAt,
              },
            ],
            cached: !params.force_refresh,
            cached_at: stream.fetchedAt,
          });
        } catch (e) {
          return handle(e, instance);
        }
      },
    },
  },
});
