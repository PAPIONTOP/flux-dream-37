/** Vidzy — extracts HLS from vidzy.live embed pages */
import type { Provider, ProviderContext, StreamResult } from "./_common";
import { fetchHtml, guessQuality } from "./_common";

const M3U8_RE = /["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i;

export const vidzy: Provider = {
  name: "vidzy",
  matches: (u) => /vidzy\./i.test(u),
  async extract(ctx: ProviderContext): Promise<StreamResult | null> {
    const codeMatch = /embed-([a-z0-9]+)\.html/i.exec(ctx.pageUrl);
    const fileCode = codeMatch?.[1];
    if (!fileCode) return null;
    const dlUrl = `https://vidzy.live/dl?op=view&file_code=${fileCode}&embed=1&adb=1`;
    const r = await fetchHtml(dlUrl, ctx.userAgent, ctx.cookies);
    if (r.status >= 400) return null;
    const m = M3U8_RE.exec(r.html);
    if (!m) return null;
    return {
      streamUrl: m[1],
      quality: guessQuality(m[1]),
      lang: ctx.lang ?? "vf",
      provider: "vidzy",
      type: "hls",
    };
  },
};
