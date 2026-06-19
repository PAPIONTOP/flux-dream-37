const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
for (const u of ["https://dood.to/e/q1q8uksgfrjz", "https://luluvid.com/e/e4zzzvhc69tx"]) {
  const r = await fetch(u, { headers: { "user-agent": ua, referer: "https://cinepulse.live/" }, redirect: "follow" });
  const html = await r.text();
  console.log("===", u, "status", r.status, "final", r.url, "len", html.length);
  console.log("has pass_md5:", /pass_md5/.test(html));
  console.log("has m3u8:", /m3u8/.test(html));
  console.log("has eval(function(p,a,c,k:", /eval\(function\(p,a,c,k/.test(html));
  console.log("first 800:", html.slice(0, 800));
  console.log();
}
