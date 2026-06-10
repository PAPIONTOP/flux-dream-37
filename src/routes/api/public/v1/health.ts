import { createFileRoute } from "@tanstack/react-router";
import { tryGetConfig } from "@/lib/config.server";

export const Route = createFileRoute("/api/public/v1/health")({
  server: {
    handlers: {
      GET: async () => {
        const cfg = tryGetConfig();
        const configured = cfg !== null;

        let tmdbOk = false;
        if (configured) {
          try {
            const r = await fetch(
              `https://api.themoviedb.org/3/configuration?api_key=${cfg.tmdbApiKey}`,
              { signal: AbortSignal.timeout(4000) },
            );
            tmdbOk = r.ok;
          } catch {
            tmdbOk = false;
          }
        }

        let dbOk = false;
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin
            .from("cache_kv" as never)
            .select("k")
            .limit(1);
          dbOk = !error;
        } catch {
          dbOk = false;
        }

        return Response.json({
          status: configured && tmdbOk && dbOk ? "ok" : "degraded",
          configured,
          db: dbOk ? "ok" : "ko",
          tmdb: tmdbOk ? "ok" : "ko",
          scraper: { active: 0, queued: 0 },
        });
      },
    },
  },
});
