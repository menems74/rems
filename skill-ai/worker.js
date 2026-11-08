// Cloudflare Worker: legge titolo e descrizione di un link.
// Deploy: dashboard Cloudflare > Workers > Create > incolla questo codice.
// Facoltativo: sostituisci "*" con l'URL del tuo sito per limitare l'uso.
const ALLOW_ORIGIN = "https://menems74.github.io";

const cors = { "Access-Control-Allow-Origin": ALLOW_ORIGIN, "Content-Type": "application/json; charset=utf-8" };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: cors });

const decode = s => (s || "")
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

const meta = (html, key) => {
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, "i");
  return decode((html.match(re1) || html.match(re2) || [])[1]);
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { headers: { ...cors, "Access-Control-Allow-Methods": "GET" } });
    const target = new URL(request.url).searchParams.get("url");
    let u;
    try { u = new URL(target); } catch { return json({ error: "url non valido" }, 400); }
    if (!/^https?:$/.test(u.protocol)) return json({ error: "protocollo non ammesso" }, 400);
    // blocco indirizzi locali/IP letterali
    if (/^(localhost|.*\.local|\d+\.\d+\.\d+\.\d+|\[.*\])$/i.test(u.hostname)) return json({ error: "host non ammesso" }, 400);

    try {
      // GitHub: API ufficiale
      if (u.hostname === "github.com") {
        const [, owner, repo] = u.pathname.split("/");
        if (owner && repo) {
          const r = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: { "User-Agent": "skill-ai", Accept: "application/vnd.github+json" } });
          if (r.ok) {
            const d = await r.json();
            return json({ title: d.full_name, description: [d.description, d.stargazers_count ? `⭐ ${d.stargazers_count}` : ""].filter(Boolean).join(" · ") });
          }
        }
      }
      // YouTube: oEmbed
      if (/(^|\.)youtube\.com$|^youtu\.be$/.test(u.hostname)) {
        const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u.href)}`);
        if (r.ok) { const d = await r.json(); return json({ title: d.title, description: d.author_name ? `Canale: ${d.author_name}` : "" }); }
      }
      // Generico: Open Graph
      const r = await fetch(u.href, { headers: { "User-Agent": "Mozilla/5.0 (compatible; SkillAI/1.0)", "Accept-Language": "it,en;q=0.8" }, redirect: "follow" });
      const html = (await r.text()).slice(0, 200000);
      const title = meta(html, "og:title") || meta(html, "twitter:title") || decode((html.match(/<title[^>]*>([^<]*)/i) || [])[1]);
      const description = meta(html, "og:description") || meta(html, "twitter:description") || meta(html, "description");
      return json({ title, description });
    } catch (e) {
      return json({ error: "lettura fallita" }, 502);
    }
  },
};
