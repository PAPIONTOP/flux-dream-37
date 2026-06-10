/** Vidmoly — looks for `sources: [{file: "..."}]` inside jwplayer setup. */
import type { Provider, ProviderContext, StreamResult } from "./_common";
import { fetchHtml, guessQuality } from "./_common";

const SOURCES_RE = /sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i;
const FALLBACK_RE = /file\s*:\s*["'](https?:[^"']+\.m3u8[^"']*)["']/i;

export const vidmoly: Provider = {
  name: "vidmoly",
  matches: (u) => /vidmoly\./i.test(u),
  async extract(ctx: ProviderContext): Promise<StreamResult | null> {
    const r = await fetchHtml(ctx.pageUrl, ctx.userAgent, ctx.cookies);
    if (r.status >= 400) return null;
    const m = SOURCES_RE.exec(r.html) ?? FALLBACK_RE.exec(r.html);
    if (!m) return null;
    const url = m[1];
    return {
      streamUrl: url,
      quality: guessQuality(url),
      lang: ctx.lang ?? "vf",
      provider: "vidmoly",
      type: "hls",
    };
  },
};
