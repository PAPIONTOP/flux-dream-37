import { fetchHtml } from "./src/lib/scraper/providers/_common.ts";
import { unpack } from "./src/lib/scraper/providers/_packer.ts";
const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const r = await fetchHtml("https://luluvid.com/e/e4zzzvhc69tx", ua, "", 10000);
console.log("status", r.status, "len", r.html.length);
// find packed section
const idx = r.html.indexOf("eval(function(p,a,c,k");
console.log("eval idx:", idx);
const slice = r.html.slice(idx, idx + 2000);
console.log("PACKED snippet:", slice.slice(0, 400));
const unp = unpack(slice);
console.log("unpacked sample:", unp?.slice(0, 1500));
