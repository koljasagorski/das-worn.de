// Worker endpoint: POST /api/chat
// Proxies a chat request to the Anthropic API with podcast context baked in.

import episodes from "../../data/episodes.json";
import stats from "../../data/stats.json";
import gags from "../../data/gags-resolved.json";

const MODEL = "claude-haiku-4-5-20251001";

const HOST_INFO_TXT = `
HOSTS:
- Etienne Garde (oft "Eddi"/"Eddie"): Schauspieler, Moderator, Synchronsprecher. Bekannt von Rocket Beans TV.
- Jochen: Mann mit USB-Maus die spinnt, ruft öfter mal die Polizei wegen Kleinigkeiten, Hund Poppy.
- Georg: Der Rätselmeister. Stellt fast immer am Folgenende das Rätsel.
`;

function buildSystemPrompt() {
  // Slim episode index (only number + title) to keep context manageable.
  const epList = episodes
    .map((e) => `#${e.number} ${e.title}`)
    .join("\n");

  // Top gags
  const gagList = Object.values(gags)
    .filter((g) => g && g.name)
    .sort((a, b) => b.episodeCount - a.episodeCount)
    .map((g) => `- ${g.name} (${g.episodeCount} Folgen): ${g.description}`)
    .join("\n");

  // Top winners (use computed stats)
  const w = stats.winners || {};
  const winners = `Stand der Punktetabelle: Jochen ${w.jochen || 0}, Etienne ${w.etienne || 0}, Georg ${w.georg || 0}.`;

  return `Du bist der freundliche Wiki-Assistent von "das worn" – dem Wiki Ohne Richtigen Namen zum Podcast ohne richtigen Namen mit Etienne Garde, Jochen und Georg. Antworte auf Deutsch, locker und prägnant.

${HOST_INFO_TXT}

ZAHLEN:
- ${stats.episodeCount} Folgen erfasst, ~${stats.estimatedHours}h Hörzeit, ${stats.totalWords.toLocaleString("de-DE")} Wörter.
- ${winners}

WIEDERKEHRENDE THEMEN:
${gagList}

FOLGEN-INDEX:
${epList}

REGELN:
- Wenn du eine konkrete Folgennummer/Titel kennst, nenne sie (z.B. "siehe Folge #100 Dreistellig").
- Wenn du etwas nicht sicher weißt, sag es offen. Erfinde keine Rätselauflösungen.
- Halte Antworten kurz: meist 1-3 Sätze, mehr nur auf Nachfrage.
- Pommes-Witze sind erlaubt.`;
}

const SYSTEM = buildSystemPrompt();

const PAYPAL_NUDGE = `\n\n☕ Wenn dir das Wiki gefällt: Du kannst Kolja eine Spende dalassen via [paypal.me/gigalogi](https://paypal.me/gigalogi) oder an paypal@koljasagorski.de.`;

export async function handleChat(c) {
  const apiKey = c.env?.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return c.json({
      error: "Chat ist gerade deaktiviert – ANTHROPIC_API_KEY ist nicht konfiguriert. (`wrangler secret put ANTHROPIC_API_KEY`)",
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

  // Defensive limits
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

  // Count user turns; after 3 user messages, append PayPal nudge to the assistant response.
  const userTurns = messages.filter((m) => m.role === "user").length;
  const appendNudge = userTurns >= 3 && userTurns % 3 === 0;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        system: SYSTEM,
        messages,
      }),
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      return c.json({ error: "Upstream error", status: r.status, detail: errText.slice(0, 400) }, 502);
    }
    const data = await r.json();
    const text = (data?.content?.[0]?.text || "").trim();
    const reply = appendNudge ? text + PAYPAL_NUDGE : text;
    return c.json({ reply, userTurns, nudgeAttached: appendNudge });
  } catch (e) {
    return c.json({ error: "Upstream fetch failed", detail: String(e).slice(0, 200) }, 502);
  }
}
