import { Hono } from "hono";
import episodes from "../data/episodes.json";
import stats from "../data/stats.json";
import gags from "../data/gags-resolved.json";
import {
  renderHome,
  renderEpisodesList,
  renderEpisode,
  renderHosts,
  renderRaetsel,
  renderStats,
  renderAbout,
  renderNotFound,
  renderLoreIndex,
  renderLoreDetail,
  renderChat,
  renderBusinessIdeas,
  renderPommes,
} from "./views/pages.js";
import { handleChat } from "./api/chat.js";
import businessIdeas from "../data/business-ideas.json";

const app = new Hono();

// Tiny security & caching defaults
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
});

const html = (c, body) => c.html(body, 200, { "Cache-Control": "public, max-age=600" });

app.get("/", (c) => html(c, renderHome({ stats, episodes, gags })));

app.get("/folgen", (c) => html(c, renderEpisodesList({ episodes, query: c.req.query("q") })));

app.get("/folge/:num{[0-9]+}", (c) => {
  const num = parseInt(c.req.param("num"), 10);
  const idx = episodes.findIndex((e) => e.number === num);
  if (idx === -1) return c.html(renderNotFound(), 404);
  const ep = episodes[idx];
  // prev/next by number-sorted list
  const sorted = [...episodes].sort((a, b) => a.number - b.number);
  const sortedIdx = sorted.findIndex((e) => e.number === num);
  const prev = sortedIdx > 0 ? sorted[sortedIdx - 1] : null;
  const next = sortedIdx < sorted.length - 1 ? sorted[sortedIdx + 1] : null;
  return html(c, renderEpisode({ episode: ep, prev, next }));
});

app.get("/hosts", (c) => html(c, renderHosts({ stats })));
app.get("/raetsel", (c) => html(c, renderRaetsel({ episodes, stats })));
app.get("/statistiken", (c) => html(c, renderStats({ stats })));
app.get("/about", (c) => html(c, renderAbout({ stats })));

app.get("/lore", (c) => html(c, renderLoreIndex({ gags })));
app.get("/lore/:key", (c) => {
  const gag = gags[c.req.param("key")];
  if (!gag) return c.html(renderNotFound(), 404);
  return html(c, renderLoreDetail({ gag, episodes }));
});

app.get("/chat", (c) => c.html(renderChat({ stats }), 200, { "Cache-Control": "public, max-age=300" }));
app.post("/api/chat", handleChat);
app.get("/business-ideen", (c) => html(c, renderBusinessIdeas({ businessIdeas, episodes })));

// Sitemap & robots
const SITE_URL = "https://das-worn.de";
app.get("/sitemap.xml", (c) => {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: "/", priority: 1.0, changefreq: "weekly" },
    { loc: "/folgen", priority: 0.9, changefreq: "weekly" },
    { loc: "/raetsel", priority: 0.8, changefreq: "weekly" },
    { loc: "/lore", priority: 0.7, changefreq: "monthly" },
    { loc: "/business-ideen", priority: 0.7, changefreq: "weekly" },
    { loc: "/hosts", priority: 0.7, changefreq: "monthly" },
    { loc: "/statistiken", priority: 0.6, changefreq: "weekly" },
    { loc: "/chat", priority: 0.5, changefreq: "monthly" },
    { loc: "/about", priority: 0.3, changefreq: "yearly" },
  ];
  for (const e of episodes) {
    urls.push({ loc: `/folge/${e.number}`, priority: 0.6, changefreq: "monthly" });
  }
  for (const key of Object.keys(gags)) {
    if (key.startsWith("_")) continue;
    urls.push({ loc: `/lore/${key}`, priority: 0.5, changefreq: "monthly" });
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((u) => `  <url>
    <loc>${SITE_URL}${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority.toFixed(1)}</priority>
  </url>`)
  .join("\n")}
</urlset>`;
  return c.body(xml, 200, {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
  });
});

// Easter egg routes
app.get("/pommes", (c) => html(c, renderPommes()));
app.get("/eddi", (c) => c.redirect("/hosts#etienne", 302));
app.get("/onkel-barlow", (c) => c.redirect("/hosts#georg", 302));
app.get("/noriega", (c) => c.redirect("/folge/1", 302));
app.get("/kreidefrau", (c) => c.redirect("/lore/kreidefrau", 302));
app.get("/stradivari", (c) => c.redirect("/lore/stradivari", 302));

app.get("/random", (c) => {
  const ep = episodes[Math.floor(Math.random() * episodes.length)];
  return c.redirect(`/folge/${ep.number}`, 302);
});

// JSON API endpoints (handy for fans who want raw data)
app.get("/api/episodes", (c) =>
  c.json(
    episodes.map((e) => ({
      number: e.number,
      title: e.title,
      wordCount: e.wordCount,
      hostMentions: e.hostMentions,
      winner: e.raetsel.winner || e.raetsel.heuristicWinner,
    })),
  ),
);
app.get("/api/stats", (c) => c.json(stats));
app.get("/api/episode/:num", (c) => {
  const num = parseInt(c.req.param("num"), 10);
  const ep = episodes.find((e) => e.number === num);
  if (!ep) return c.json({ error: "not found" }, 404);
  return c.json(ep);
});

// 404
app.notFound((c) => c.html(renderNotFound(), 404));

export default app;
