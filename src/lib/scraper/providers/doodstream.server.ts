/**
 * Doodstream — generates a temporary signed URL by calling /pass_md5/.
 * NOTE: doodstream's tokens are short-lived and may require a real browser
 * referer; this works best-effort.
 */
import type { Provider, ProviderContext, StreamResult } from "./_common";
import { fetchHtml, guessQuality } from "./_common";

const PASS_RE = /\/pass_md5\/([a-zA-Z0-9\/-]+)/i;
const TOKEN_RE = /a\s*=\s*["']([^"']+)["']/i;

function randomString(len: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export const doodstream: Provider = {
  name: "doodstream",
  matches: (u) => /\bdood/i.test(u),
  async extract(ctx: ProviderContext): Promise<StreamResult | null> {
    const r = await fetchHtml(ctx.pageUrl, ctx.userAgent, ctx.cookies);
    if (r.status >= 400) return null;
    const passMatch = PASS_RE.exec(r.html);
    const tokenMatch = TOKEN_RE.exec(r.html);
    if (!passMatch) return null;
    const passPath = passMatch[0];
    const token = tokenMatch?.[1] ?? "";

    const origin = new URL(ctx.pageUrl).origin;
    const passUrl = origin + passPath;
    let res: Response;
    try {
      res = await fetch(passUrl, {
        headers: { "user-agent": ctx.userAgent, referer: ctx.pageUrl },
        signal: AbortSignal.timeout(7000),
      });
    } catch {
      return null;
    }
    if (!res.ok) return null;
    const base = await res.text();
    const expiry = Date.now();
    const random = randomString(10);
    const url = `${base}${random}?token=${token}&expiry=${expiry}`;
    return {
      streamUrl: url,
      quality: guessQuality(url),
      lang: ctx.lang ?? "vf",
      provider: "doodstream",
      type: "hls",
    };
  },
};
