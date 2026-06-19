import { fetchCinepulseLinks } from "./src/lib/scraper/fetch.server.ts";
const url = process.argv[2] || "https://cinepulse.live/movie/fight-club";
const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
for (const lang of ["vf", "fr", "vostfr", "en"]) {
  const links = await fetchCinepulseLinks(url, ua, lang);
  console.log(lang, "->", links);
}
