import { fetchHtml } from "./src/lib/scraper/providers/_common.ts";
const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const r = await fetchHtml("https://luluvid.com/e/e4zzzvhc69tx", ua, "", 10000);
const idx = r.html.indexOf("eval(function(p,a,c,k");
const end = r.html.indexOf("</script>", idx);
const slice = r.html.slice(idx, end);
console.log("len:", slice.length);
// find split('|')
const splitIdx = slice.indexOf(".split('|')");
console.log("split idx:", splitIdx);
console.log("before split:", slice.slice(splitIdx-300, splitIdx+30));
console.log();
console.log("after split:", slice.slice(splitIdx, splitIdx+100));
