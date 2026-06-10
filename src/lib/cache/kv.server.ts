/**
 * Cache wrapper backed by the Postgres `cache_kv` table.
 * TTL is enforced via the `expires_at` column.
 */
import { logger } from "../logger";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const kv = {
  async get<T>(key: string): Promise<T | null> {
    const sb = await admin();
    const { data, error } = await sb
      .from("cache_kv" as never)
      .select("v, expires_at")
      .eq("k", key)
      .maybeSingle();
    if (error) {
      logger.warn("kv_get_error", { key, error: error.message });
      return null;
    }
    if (!data) return null;
    const row = data as { v: T; expires_at: string };
    if (new Date(row.expires_at).getTime() < Date.now()) {
      // Expired — best effort cleanup, ignore failure.
      await sb.from("cache_kv" as never).delete().eq("k", key);
      return null;
    }
    return row.v;
  },

  async set<T>(key: string, value: T, ttlSec: number): Promise<void> {
    const sb = await admin();
    const expires_at = new Date(Date.now() + ttlSec * 1000).toISOString();
    const { error } = await sb
      .from("cache_kv" as never)
      .upsert({ k: key, v: value as never, expires_at }, { onConflict: "k" });
    if (error) logger.warn("kv_set_error", { key, error: error.message });
  },

  async del(key: string): Promise<void> {
    const sb = await admin();
    await sb.from("cache_kv" as never).delete().eq("k", key);
  },

  async listByPrefix(prefix: string, limit = 200): Promise<Array<{ k: string; expires_at: string }>> {
    const sb = await admin();
    const { data, error } = await sb
      .from("cache_kv" as never)
      .select("k, expires_at")
      .like("k", `${prefix}%`)
      .limit(limit);
    if (error) {
      logger.warn("kv_list_error", { prefix, error: error.message });
      return [];
    }
    return (data ?? []) as Array<{ k: string; expires_at: string }>;
  },

  async delByPrefix(prefix: string): Promise<number> {
    const sb = await admin();
    const { data, error } = await sb
      .from("cache_kv" as never)
      .delete()
      .like("k", `${prefix}%`)
      .select("k");
    if (error) {
      logger.warn("kv_del_prefix_error", { prefix, error: error.message });
      return 0;
    }
    return (data ?? []).length;
  },
};
