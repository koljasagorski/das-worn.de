// Worker endpoint: POST /api/chat
// Uses Cloudflare Workers AI (bound as env.AI) to answer questions about
// the podcast. No external API key required.

import episodes from "../../data/episodes.json";
import stats from "../../data/stats.json";
import gags from "../../data/gags-resolved.json";

// Llama 3.3 70b fast — solid German support, runs on Workers AI.
// Smaller fallback if the big one is overloaded.
const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const FALLBACK_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

const HOST_INFO_TXT = `
HOSTS:
- Etienne Gardé (oft "Eddi" / "Eddie"): Schauspieler, Moderator, Synchronsprecher. Mitgründer von Rocket Beans TV.
- Jochen Dominicus: Mann mit USB-Maus, Hund Poppy, ruft öfter mal die Polizei. Co-Host von "Pinkelpause".
- Georg Zaal ("Onkel Barlow"): Der Rätselmeister, stellt fast immer am Folgenende das Rätsel.
`;

function buildSystemPrompt() {
  const epList = episodes
    .map((e) => `#${e.number} ${e.title}`)
    .join("\n");

  const gagList = Object.values(gags)
    .filter((g) => g && g.name)
    .sort((a, b) => b.episodeCount - a.episodeCount)
    .map((g) => `- ${g.name} (${g.episodeCount} Folgen): ${g.description}`)
    .join("\n");

  const w = stats.winners || {};
  const winners = `Stand der Punktetabelle: Jochen ${w.jochen || 0}, Etienne ${w.etienne || 0}, Georg ${w.georg || 0}.`;

  return `Du bist der freundliche Wiki-Assistent von "das worn" – dem Wiki Ohne Richtigen Namen zum Podcast ohne richtigen Namen mit Etienne Gardé, Jochen Dominicus und Georg Zaal. Antworte auf Deutsch, locker und prägnant.

${HOST_INFO_TXT}

ZAHLEN:
- ${stats.episodeCount} Folgen erfasst, ~${stats.estimatedHours}h Hörzeit, ${stats.totalWords.toLocaleString("de-DE")} Wörter.
- ${winners}

WIEDERKEHRENDE THEMEN:
${gagList}

FOLGEN-INDEX (Auszug der Titel):
${epList}

REGELN:
- Wenn du eine konkrete Folgennummer/Titel kennst, nenne sie (z.B. "siehe Folge #100 Dreistellig").
- Wenn du etwas nicht sicher weißt, sag es offen. Erfinde keine Rätselauflösungen.
- Halte Antworten kurz: meist 1-3 Sätze, mehr nur auf Nachfrage.
- Pommes-Witze sind erlaubt.`;
}

const SYSTEM = buildSystemPrompt();

async function runModel(env, modelId, messages) {
  return await env.AI.run(modelId, {
    messages: [{ role: "system", content: SYSTEM }, ...messages],
    max_tokens: 500,
    temperature: 0.7,
  });
}

export async function handleChat(c) {
  const env = c.env;
  if (!env?.AI) {
    return c.json({
      error: "Chat ist gerade deaktiviert – Workers AI ist nicht gebunden. Stelle sicher, dass [ai] binding=\"AI\" in wrangler.toml steht.",
    }, 503);
  }

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const messages = Array.isArray(body.messages) ? body.messages : null;
  if (!messages || messages.length === 0) {
    return c.json({ error: "messages array required" }, 400);
  }
  if (messages.length > 30) {
    return c.json({ error: "Konversation zu lang. Frische sie neu auf." }, 400);
  }
  for (const m of messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) {
      return c.json({ error: "Each message needs role user|assistant" }, 400);
    }
    if (typeof m.content !== "string" || m.content.length > 2000) {
      return c.json({ error: "Each message.content must be a string ≤2000 chars" }, 400);
    }
  }

  let result;
  let usedModel = MODEL;
  try {
    result = await runModel(env, MODEL, messages);
  } catch (e) {
    try {
      result = await runModel(env, FALLBACK_MODEL, messages);
      usedModel = FALLBACK_MODEL;
    } catch (e2) {
      return c.json({ error: "Workers AI Fehler", detail: String(e2).slice(0, 200) }, 502);
    }
  }

  const text = (result?.response || result?.result?.response || "").trim();
  if (!text) return c.json({ error: "Leere Antwort vom Modell" }, 502);
  return c.json({ reply: text, model: usedModel });
}
