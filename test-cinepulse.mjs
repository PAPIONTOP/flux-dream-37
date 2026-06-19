import * as cheerio from "cheerio";
const url = process.argv[2] || "https://cinepulse.live/movie/fight-club";
const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const r = await fetch(url, { headers: { "user-agent": ua } });
console.log("status", r.status);
const html = await r.text();
console.log("len", html.length);
const $ = cheerio.load(html);
let snap = "", id = "";
$("[wire\\:snapshot]").each((_, el) => {
  const s = $(el).attr("wire:snapshot") ?? "";
  console.log("found snap with len", s.length, "contains watch:", s.includes("watch-component"));
  if (s.includes("watch-component")) { snap = s; id = $(el).attr("wire:id") ?? ""; }
});
console.log("wireId:", id);
console.log("snapshot first 500:", snap.slice(0, 500));
