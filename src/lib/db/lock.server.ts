/**
 * Per-content lock to prevent concurrent scrapes.
 * Backed by `scraper_lock` table (PK conflict = lock held).
 */
import { logger } from "../logger";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const lock = {
  /** Try to acquire. Returns true if acquired, false if already locked. */
  async acquire(key: string, ttlSec = 30): Promise<boolean> {
    const sb = await admin();
    const now = Date.now();
    const expires_at = new Date(now + ttlSec * 1000).toISOString();

    // Best-effort cleanup of stale locks before insert.
    await sb
      .from("scraper_lock" as never)
      .delete()
      .lt("expires_at", new Date(now).toISOString());

    const { error } = await sb
      .from("scraper_lock" as never)
      .insert({ k: key, expires_at } as never);
    if (error) {
      // Most likely PK conflict — lock is held.
      logger.debug("lock_busy", { key });
      return false;
    }
    return true;
  },

  async release(key: string): Promise<void> {
    const sb = await admin();
    await sb.from("scraper_lock" as never).delete().eq("k", key);
  },
};
