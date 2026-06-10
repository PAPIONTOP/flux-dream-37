import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAdminKey } from "@/lib/api/auth";
import { handle, ApiError } from "@/lib/api/errors";
import { testExtract } from "@/lib/scraper/index.server";

const QuerySchema = z.object({ url: z.string().url() });

export const Route = createFileRoute("/api/public/v1/admin/scraper/test")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const instance = url.pathname + url.search;
        try {
          requireAdminKey(request);
          const { url: target } = QuerySchema.parse(
            Object.fromEntries(url.searchParams.entries()),
          );
          const result = await testExtract(target);
          if (!result) throw new ApiError("NO_STREAM_FOUND", `No stream at ${target}`);
          return Response.json(result);
        } catch (e) {
          return handle(e, instance);
        }
      },
    },
  },
});
