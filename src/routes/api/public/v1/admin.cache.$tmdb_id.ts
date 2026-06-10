import { createFileRoute } from "@tanstack/react-router";
import { requireAdminKey } from "@/lib/api/auth";
import { handle } from "@/lib/api/errors";
import { kv } from "@/lib/cache/kv.server";

export const Route = createFileRoute("/api/public/v1/admin/cache/$tmdb_id")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        const url = new URL(request.url);
        const instance = url.pathname;
        try {
          requireAdminKey(request);
          const id = params.tmdb_id;
          const removedMovie = await kv.delByPrefix(`stream:movie:${id}:`);
          const removedTv = await kv.delByPrefix(`stream:tv:${id}:`);
          const removedSlug = await kv.delByPrefix(`source:slug:movie:${id}`);
          const removedSlugTv = await kv.delByPrefix(`source:slug:tv:${id}`);
          return Response.json({
            invalidated:
              removedMovie + removedTv + removedSlug + removedSlugTv,
          });
        } catch (e) {
          return handle(e, instance);
        }
      },
    },
  },
});
