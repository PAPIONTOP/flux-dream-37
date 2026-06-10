import { createFileRoute } from "@tanstack/react-router";
import { requireAdminKey } from "@/lib/api/auth";
import { handle } from "@/lib/api/errors";
import { kv } from "@/lib/cache/kv.server";

export const Route = createFileRoute("/api/public/v1/admin/cache")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const instance = url.pathname + url.search;
        try {
          requireAdminKey(request);
          const prefix = url.searchParams.get("prefix") ?? "stream:";
          const keys = await kv.listByPrefix(prefix, 500);
          return Response.json({ count: keys.length, keys });
        } catch (e) {
          return handle(e, instance);
        }
      },
    },
  },
});
