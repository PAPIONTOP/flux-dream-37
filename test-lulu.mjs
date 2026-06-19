import { luluvid } from "./src/lib/scraper/providers/luluvid.server.ts";
const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const r = await luluvid.extract({ pageUrl: "https://luluvid.com/e/e4zzzvhc69tx", lang: "vf", userAgent: ua, cookies: "" });
console.log(r);
