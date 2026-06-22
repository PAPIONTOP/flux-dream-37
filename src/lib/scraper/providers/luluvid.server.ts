/** Luluvid / Lulustream — extracts HLS from packed jwplayer source. */
import type { Provider, ProviderContext, StreamResult } from "./_common";
import { fetchHtml, guessQuality } from "./_common";
import { unpack } from "./_packer";

const M3U8_RE = /(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i;

export const luluvid: Provider = {
  name: "luluvid",
  matches: (u) => /\b(luluvid|lulustream|lulu\.st|luluvdo)\b/i.test(u),
  async extract(ctx: ProviderContext): Promise<StreamResult | null> {
    const r = await fetchHtml(ctx.pageUrl, ctx.userAgent, ctx.cookies, 10000);
    if (r.status >= 400) return null;
    // Try raw match first
    let m = M3U8_RE.exec(r.html);
    if (!m) {
      const unpacked = unpack(r.html);
      if (unpacked) m = M3U8_RE.exec(unpacked);
    }
    if (!m) return null;
    return {
      streamUrl: m[1],
      embedUrl: r.finalUrl || ctx.pageUrl,
      quality: guessQuality(m[1]),
      lang: ctx.lang ?? "vf",
      provider: "luluvid",
      type: "hls",
      referer: r.finalUrl || ctx.pageUrl,
    };
  },
};
