/** Uqload / upvid — sources array in HTML, mp4 served as HLS-ish. Best effort. */
import type { Provider, ProviderContext, StreamResult } from "./_common";
import { fetchHtml, guessQuality } from "./_common";

const SOURCES_RE = /sources\s*:\s*\[\s*["'](https?:[^"']+\.(?:m3u8|mp4)[^"']*)["']/i;

export const uqload: Provider = {
  name: "uqload",
  matches: (u) => /(uqload|upvid)\./i.test(u),
  async extract(ctx: ProviderContext): Promise<StreamResult | null> {
    const r = await fetchHtml(ctx.pageUrl, ctx.userAgent, ctx.cookies);
    if (r.status >= 400) return null;
    const m = SOURCES_RE.exec(r.html);
    if (!m) return null;
    const url = m[1];
    return {
      streamUrl: url,
      quality: guessQuality(url),
      lang: ctx.lang ?? "vf",
      provider: "uqload",
      type: "hls",
    };
  },
};
