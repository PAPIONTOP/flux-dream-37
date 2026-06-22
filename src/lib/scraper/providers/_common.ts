/** Provider interface shared by all extractors. */
export interface StreamResult {
  streamUrl: string;
  /** Original provider embed page; useful when the CDN blocks server-side proxy fetches. */
  embedUrl?: string;
  quality: string; // e.g. "1080p", "720p", "auto"
  lang: string; // e.g. "vf", "vostfr", "en"
  provider: string;
  type: "hls";
  /** Provider page to send as Referer when the HLS URL must be proxied. */
  referer?: string;
}

export interface ProviderContext {
  pageUrl: string;
  html?: string;
  lang?: string;
  userAgent: string;
  cookies: string;
}

export interface Provider {
  name: string;
  /** Returns true if this provider can handle the given URL. */
  matches(url: string): boolean;
  /** Extracts a stream from the iframe/page URL. May throw. */
  extract(ctx: ProviderContext): Promise<StreamResult | null>;
}

/** Fetch helper that mimics a browser. */
export async function fetchHtml(
  url: string,
  ua: string,
  cookies: string,
  timeoutMs = 7000,
): Promise<{ status: number; html: string; finalUrl: string }> {
  const res = await fetch(url, {
    headers: {
      "user-agent": ua,
      "accept-language": "fr-FR,fr;q=0.9,en;q=0.8",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ...(cookies ? { cookie: cookies } : {}),
    },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const html = await res.text();
  return { status: res.status, html, finalUrl: res.url || url };
}

export function guessQuality(url: string): string {
  if (/2160p|4k/i.test(url)) return "2160p";
  if (/1080p|fhd/i.test(url)) return "1080p";
  if (/720p|hd/i.test(url)) return "720p";
  if (/480p|sd/i.test(url)) return "480p";
  if (/360p/i.test(url)) return "360p";
  return "auto";
}
