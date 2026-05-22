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
