/**
 * Admin: report the current source-related env. Hot-reloading config from
 * a POST body isn't useful here (env is process-managed); we just echo
 * what's currently active, which is the practical equivalent.
 */
import { createFileRoute } from "@tanstack/react-router";
import { requireAdminKey } from "@/lib/api/auth";
import { handle } from "@/lib/api/errors";
import { getConfig } from "@/lib/config.server";

export const Route = createFileRoute("/api/public/v1/admin/source")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const instance = url.pathname;
        try {
          requireAdminKey(request);
          const cfg = getConfig();
          return Response.json({
            source: {
              base_url: cfg.source.baseUrl,
              movie_path: cfg.source.moviePath,
              series_path: cfg.source.seriesPath,
              user_agent: cfg.source.userAgent,
              cookies_set: cfg.source.cookies.length > 0,
            },
            scraper: {
              concurrency: cfg.scraperConcurrency,
              stream_cache_ttl: cfg.streamCacheTtl,
              proxy_token_ttl: cfg.proxyTokenTtl,
            },
            note: "Update env secrets via the Lovable dashboard, then reload.",
          });
        } catch (e) {
          return handle(e, instance);
        }
      },
    },
  },
});
