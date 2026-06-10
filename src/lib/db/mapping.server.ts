/** CRUD for tmdb_mapping (tmdb_id, media_type) -> source_slug. */
import { logger } from "../logger";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const mapping = {
  async get(tmdbId: number, mediaType: "movie" | "tv"): Promise<string | null> {
    const sb = await admin();
    const { data, error } = await sb
      .from("tmdb_mapping" as never)
      .select("source_slug")
      .eq("tmdb_id", tmdbId)
      .eq("media_type", mediaType)
      .maybeSingle();
    if (error) {
      logger.warn("mapping_get_error", { tmdbId, mediaType, error: error.message });
      return null;
    }
    return data ? (data as { source_slug: string }).source_slug : null;
  },

  async upsert(tmdbId: number, mediaType: "movie" | "tv", slug: string): Promise<void> {
    const sb = await admin();
    const { error } = await sb
      .from("tmdb_mapping" as never)
      .upsert(
        { tmdb_id: tmdbId, media_type: mediaType, source_slug: slug },
        { onConflict: "tmdb_id,media_type" },
      );
    if (error) logger.warn("mapping_upsert_error", { tmdbId, error: error.message });
  },

  async delete(tmdbId: number): Promise<void> {
    const sb = await admin();
    await sb.from("tmdb_mapping" as never).delete().eq("tmdb_id", tmdbId);
  },
};
