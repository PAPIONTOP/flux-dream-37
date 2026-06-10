/**
 * Voe — sources are base64-encoded inside the HTML. Without a real browser
 * we try the static fallback (sometimes 'hls' is a plain m3u8 in JSON).
 */
import type { Provider, ProviderContext, StreamResult } from "./_common";
import { fetchHtml, guessQuality } from "./_common";

const HLS_RE = /["']hls["']\s*:\s*["']([^"']+)["']/i;
const JSON_RE = /var\s+sources\s*=\s*(\{[\s\S]*?\});/i;

function tryBase64(s: string): string | null {
  try {
    // jose's atob substitute via globalThis (Worker provides it)
    const decoded = typeof atob === "function" ? atob(s) : Buffer.from(s, "base64").toString("utf-8");
    if (/^https?:\/\//.test(decoded)) return decoded;
    return null;
  } catch {
    return null;
  }
}

export const voe: Provider = {
  name: "voe",
  matches: (u) => /voe\.sx|voe-/i.test(u),
  async extract(ctx: ProviderContext): Promise<StreamResult | null> {
    const r = await fetchHtml(ctx.pageUrl, ctx.userAgent, ctx.cookies);
    if (r.status >= 400) return null;

    const direct = HLS_RE.exec(r.html);
    if (direct) {
      const url = /^https?:/.test(direct[1]) ? direct[1] : tryBase64(direct[1]);
      if (url) {
        return {
          streamUrl: url,
          quality: guessQuality(url),
          lang: ctx.lang ?? "vf",
          provider: "voe",
          type: "hls",
        };
      }
    }
    const json = JSON_RE.exec(r.html);
    if (json) {
      const m = /["']hls["']\s*:\s*["']([^"']+)["']/i.exec(json[1]);
      if (m) {
        const url = /^https?:/.test(m[1]) ? m[1] : tryBase64(m[1]);
        if (url) {
          return {
            streamUrl: url,
            quality: guessQuality(url),
            lang: ctx.lang ?? "vf",
            provider: "voe",
            type: "hls",
          };
        }
      }
    }
    return null;
  },
};
