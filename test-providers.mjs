import { pickProvider } from "./src/lib/scraper/resolver.server.ts";
const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
for (const link of ["https://dood.to/e/q1q8uksgfrjz", "https://luluvid.com/e/e4zzzvhc69tx"]) {
  const p = pickProvider(link);
  console.log("LINK:", link, "PROVIDER:", p.name);
  try {
    const r = await p.extract({ pageUrl: link, lang: "vf", userAgent: ua, cookies: "" });
    console.log("RESULT:", r);
  } catch (e) { console.log("ERR:", String(e)); }
}
