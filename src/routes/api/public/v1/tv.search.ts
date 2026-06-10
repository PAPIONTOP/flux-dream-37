import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireApiKey } from "@/lib/api/auth";
import { handle } from "@/lib/api/errors";
import { tmdb } from "@/lib/tmdb/client";
import { mapping } from "@/lib/db/mapping.server";

const QuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export const Route = createFileRoute("/api/public/v1/tv/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const instance = url.pathname + url.search;
        try {
          requireApiKey(request);
          const { q, limit } = QuerySchema.parse(
            Object.fromEntries(url.searchParams.entries()),
          );
          const r = await tmdb.searchTv(q);
          const slice = r.results.slice(0, limit);
          const results = await Promise.all(
            slice.map(async (t) => ({
              tmdb_id: t.id,
              title: t.name,
              year: t.first_air_date ? Number(t.first_air_date.slice(0, 4)) : null,
              poster: tmdb.posterUrl(t.poster_path),
              overview: t.overview,
              available: !!(await mapping.get(t.id, "tv")),
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
