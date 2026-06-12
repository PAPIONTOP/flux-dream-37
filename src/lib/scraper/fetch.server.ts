/**
 * Page fetcher + iframe discovery via cheerio.
 */
import * as cheerio from "cheerio";
import { fetchHtml } from "./providers/_common";

export interface PageInfo {
  status: number;
  html: string;
  finalUrl: string;
  iframes: string[];
}

export async function fetchPage(
  url: string,
  userAgent: string,
  cookies: string,
): Promise<PageInfo> {
  const r = await fetchHtml(url, userAgent, cookies, 7000);
  const iframes: string[] = [];
  if (r.status < 400 && r.html) {
    const $ = cheerio.load(r.html);
    $("iframe[src]").each((_, el) => {
      const src = $(el).attr("src");
      if (src) iframes.push(absolutize(src, r.finalUrl));
    });
    // Some sites use data-src
    $("iframe[data-src]").each((_, el) => {
      const src = $(el).attr("data-src");
      if (src) iframes.push(absolutize(src, r.finalUrl));
    });
  }
  return { status: r.status, html: r.html, finalUrl: r.finalUrl, iframes };
}

function absolutize(src: string, base: string): string {
  try {
    return new URL(src, base).toString();
  } catch {
    return src;
  }
}

/** Verify a stream URL is reachable (HEAD then GET range fallback). */
export async function verifyStream(
  url: string,
  userAgent: string,
  referer?: string,
): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: {
        "user-agent": userAgent,
        ...(referer ? { referer } : {}),
      },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 200 || res.status === 206) return true;
    // Some CDNs don't support HEAD — try a range GET.
    if (res.status === 405 || res.status === 403) {
      const res2 = await fetch(url, {
        method: "GET",
        headers: {
          "user-agent": userAgent,
          range: "bytes=0-1",
          ...(referer ? { referer } : {}),
        },
        signal: AbortSignal.timeout(5000),
      });
      return res2.status === 200 || res2.status === 206;
    }
    return false;
  } catch {
    return false;
  }
}

export async function fetchCinepulseLinks(
  pageUrl: string,
  userAgent: string,
  lang: string,
): Promise<string[]> {
  const page = await fetchHtml(pageUrl, userAgent, "", 10000);
  if (page.status >= 400) return [];
  const $ = cheerio.load(page.html);
  let wireId = "";
  let snapshot = "";
  $("[wire\\:snapshot]").each((_, el) => {
    const snap = $(el).attr("wire:snapshot") ?? "";
    if (snap.includes("watch-component")) {
      wireId = $(el).attr("wire:id") ?? "";
      snapshot = snap;
    }
  });
  if (!wireId || !snapshot) return [];
  const livewireRes = await fetch("https://cinepulse.live/livewire/update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "X-Livewire": "true",
      "X-Requested-With": "XMLHttpRequest",
      "Referer": pageUrl,
      "Origin": "https://cinepulse.live",
      "User-Agent": userAgent,
    },
    body: JSON.stringify({
      _token: "",
      components: [{ snapshot, updates: {}, calls: [] }],
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!livewireRes.ok) return [];
  const data = await livewireRes.json() as any;
  try {
    const snapData = JSON.parse(data.components?.[0]?.snapshot ?? "{}");
    const videos: any[] = snapData.data?.videos?.[0] ?? [];
    const langMap: Record<string, string[]> = {
      vf: ["VF"],
      fr: ["FRENCH", "TRUEFRENCH", "VF"],
      vostfr: ["VOSTFR"],
      en: ["VOSTFR", "TRUEFRENCH"],
    };
    const versions = langMap[lang.toLowerCase()] ?? ["VF", "FRENCH", "TRUEFRENCH", "VOSTFR"];
    return videos
      .filter((v: any) => versions.includes(v[0]?.version ?? ""))
      .map((v: any) => v[0]?.link)
      .filter(Boolean);
  } catch {
    return [];
  }
}
