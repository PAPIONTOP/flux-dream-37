/** Direct m3u8 found in the HTML — works for sites that inline the playlist. */
import type { Provider, ProviderContext, StreamResult } from "./_common";
import { fetchHtml, guessQuality } from "./_common";

const M3U8_RE = /(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i;

export const direct: Provider = {
  name: "direct",
  matches: () => true, // fallback
  async extract(ctx: ProviderContext): Promise<StreamResult | null> {
    let html = ctx.html;
    if (!html) {
      const r = await fetchHtml(ctx.pageUrl, ctx.userAgent, ctx.cookies);
      if (r.status >= 400) return null;
      html = r.html;
    }
    const m = M3U8_RE.exec(html);
    if (!m) return null;
    const url = m[1].replace(/\\\//g, "/");
    return {
      streamUrl: url,
      quality: guessQuality(url),
      lang: ctx.lang ?? "vf",
      provider: "direct",
      type: "hls",
    };
  },
};
