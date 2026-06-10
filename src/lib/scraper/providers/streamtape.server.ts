/**
 * Streamtape — the player concatenates a DOM segment with an obfuscated
 * suffix. We reproduce the canonical formula from the page.
 */
import type { Provider, ProviderContext, StreamResult } from "./_common";
import { fetchHtml, guessQuality } from "./_common";

const GET_VIDEO_RE =
  /document\.getElementById\(['"]norobotlink['"]\)\.innerHTML\s*=\s*([^;]+);/i;
const LITERAL_RE = /['"]([^'"]+)['"]/g;
const ROBOT_RE = /<div\s+id=["']robotlink["'][^>]*>([^<]+)</i;

export const streamtape: Provider = {
  name: "streamtape",
  matches: (u) => /streamtape\./i.test(u),
  async extract(ctx: ProviderContext): Promise<StreamResult | null> {
    const r = await fetchHtml(ctx.pageUrl, ctx.userAgent, ctx.cookies);
    if (r.status >= 400) return null;

    const expr = GET_VIDEO_RE.exec(r.html);
    const robot = ROBOT_RE.exec(r.html);
    if (!expr || !robot) return null;

    // The page does: robotlink.innerHTML = '<base>' + ('<obfuscated-suffix>').substring(N).
    // Extract every quoted literal from the expression; concatenate them.
    const parts: string[] = [];
    let lit: RegExpExecArray | null;
    while ((lit = LITERAL_RE.exec(expr[1])) !== null) {
      parts.push(lit[1]);
    }
    const subMatch = /substring\((\d+)\)/.exec(expr[1]);
    const sub = subMatch ? Number(subMatch[1]) : 0;
    const base = robot[1];
    const suffix = parts.join("").substring(sub);
    let url = base + suffix;
    if (url.startsWith("//")) url = "https:" + url;
    if (!url.startsWith("http")) return null;
    return {
      streamUrl: url,
      quality: guessQuality(url),
      lang: ctx.lang ?? "vf",
      provider: "streamtape",
      type: "hls",
    };
  },
};
