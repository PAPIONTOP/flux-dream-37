import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireApiKey } from "@/lib/api/auth";
import { handle } from "@/lib/api/errors";
import { tmdb } from "@/lib/tmdb/client";
import { mapping } from "@/lib/db/mapping.server";

const QuerySchema = z.object({
  q: z.string().min(1),
  year: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export const Route = createFileRoute("/api/public/v1/movie/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const instance = url.pathname + url.search;
        try {
          requireApiKey(request);
          const { q, year, limit } = QuerySchema.parse(
            Object.fromEntries(url.searchParams.entries()),
          );
          const r = await tmdb.searchMovie(q, year);
          const slice = r.results.slice(0, limit);
          const results = await Promise.all(
            slice.map(async (m) => ({
              tmdb_id: m.id,
              title: m.title,
              year: m.release_date ? Number(m.release_date.slice(0, 4)) : null,
              poster: tmdb.posterUrl(m.poster_path),
              overview: m.overview,
              available: !!(await mapping.get(m.id, "movie")),
            })),
          );
          return Response.json({ total: r.total_results, results });
        } catch (e) {
          return handle(e, instance);
        }
      },
    },
  },
});
