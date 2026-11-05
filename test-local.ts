import { readUrl, checkDomain, linksFor, assertPublicUrl } from "./src/core";
const r1 = await readUrl("https://example.com"); console.log(JSON.stringify({ ...r1, markdown: r1.markdown }, null, 1).slice(0, 1500));
const r2 = await readUrl("https://en.wikipedia.org/wiki/HTTP_402");
console.log({ title: r2.title, desc: r2.description, canon: r2.canonical_url, wc: r2.word_count, links: r2.links_count, lang: r2.language, published: r2.published });
console.log(r2.markdown.slice(0, 1500));
const l = await linksFor("https://example.com"); console.log(l);
const c = await checkDomain("example.com"); console.log(JSON.stringify(c, null, 1).slice(0, 2500));
for (const u of ["http://127.0.0.1/", "http://169.254.169.254/latest", "http://localhost:8080", "file:///etc/passwd", "http://[::1]/"])
  await assertPublicUrl(u).then(() => console.log("ALLOWED!", u), (e) => console.log("blocked", u, e.message));
