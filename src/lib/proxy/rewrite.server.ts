/**
 * Rewrites a HLS playlist so every URL (variant playlists + segments) points
 * back to our /proxy route. Each rewritten line carries a fresh JWT for the
 * absolute upstream URL.
 */
import { signProxyToken } from "./token.server";

/** Resolve a (possibly relative) HLS line against the playlist base URL. */
function absolutize(line: string, base: string): string {
  try {
    return new URL(line, base).toString();
  } catch {
    return line;
  }
}

export async function rewritePlaylist(
  body: string,
  upstreamUrl: string,
  proxyBase: string, // e.g. https://host/api/public/v1/proxy
  referer?: string,
): Promise<string> {
  const baseForResolve = upstreamUrl;
  const lines = body.split(/\r?\n/);
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) {
      out.push(line);
      continue;
    }
    if (line.startsWith("#")) {
      // Some tags carry URIs (EXT-X-KEY, EXT-X-MAP, EXT-X-MEDIA).
      const rewritten = await rewriteUriInTag(line, baseForResolve, proxyBase, referer);
      out.push(rewritten);
      continue;
    }
    // Plain URI line (variant playlist or segment).
    const abs = absolutize(line, baseForResolve);
    const { token } = await signProxyToken({ u: abs, r: referer });
    // Suffix preserves extension so player heuristics still work.
    const ext = abs.split("?")[0].endsWith(".m3u8") ? "playlist.m3u8" : "segment.ts";
    out.push(`${proxyBase}/${token}/${ext}`);
  }
  return out.join("\n");
}

const URI_ATTR_RE = /URI="([^"]+)"/g;

async function rewriteUriInTag(
  tag: string,
  base: string,
  proxyBase: string,
  referer?: string,
): Promise<string> {
  const matches = [...tag.matchAll(URI_ATTR_RE)];
  if (matches.length === 0) return tag;
  let result = tag;
  for (const m of matches) {
    const abs = absolutize(m[1], base);
    const { token } = await signProxyToken({ u: abs, r: referer });
    const proxied = `${proxyBase}/${token}/key`;
    result = result.replace(m[0], `URI="${proxied}"`);
  }
  return result;
}
