#!/usr/bin/env node
// Calls the `claude` CLI per episode to extract structured Rätsel info.
// Output is merged into data/raetsel-overrides.json.
//
// Usage:
//   node scripts/extract-raetsel.mjs              # default: 15 spread episodes
//   node scripts/extract-raetsel.mjs 1 5 50 100   # specific episodes
//   node scripts/extract-raetsel.mjs --all        # all 361 (expensive)

import { readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TRANSCRIPT_DIR = join(ROOT, "transscript");
const OVERRIDES = join(ROOT, "data", "raetsel-overrides.json");

const MODEL = "claude-haiku-4-5-20251001";
// We send the complete episode transcript. Haiku has a 200K token context;
// even the longest episode (~20k words ≈ 30k tokens) fits with room to spare.
const MAX_CHARS = 120000;

const SYSTEM = `Du bist ein Daten-Extraktions-Bot. Du bekommst das komplette Transkript einer deutschsprachigen Podcast-Folge und gibst NUR ein JSON-Objekt zurück. Kein Fließtext, keine Erklärung, kein Markdown – nur das JSON.

Hintergrund: Der Podcast "Podcast ohne richtigen Namen" hat drei Hosts: Etienne (auch "Eddi"/"Eddie"), Jochen, Georg. In fast jeder Folge gibt es ein Rätsel – meistens stellt Georg es, manchmal Etienne oder Jochen. Das Rätsel kann am Anfang, in der Mitte oder am Ende der Folge stehen. Etienne und Jochen (bzw. die jeweils anderen beiden) raten. Wer das Rätsel zuerst löst, kriegt den Punkt. Es werden auch halbe oder Viertelpunkte vergeben.

Häufige Sprach-Patterns für den Sieger:
- "Du hast es gelöst" / "Punkt für dich"
- "[Name] gewinnt" / "[Name] hat den Punkt"
- "Ja, genau" als direkte Antwort auf eine konkrete Vermutung (dann hat der Vermutende den Punkt)
- "Den erkennen wir an" / "Wir geben den Punkt nachträglich an [Name]"
- "Halber Punkt für [Name]" / "Viertelpunkt"

Format (exakt diese Keys, keine zusätzlichen):
{"question": string|null, "answer": string|null, "winner": "etienne"|"jochen"|"georg"|null, "skipped": boolean, "confidence": "high"|"medium"|"low", "notes": string|null}

Regeln:
- question: Knappe Beschreibung der Rätselfrage in einem Satz.
- answer: Die Auflösung in einem Satz.
- winner: Wer den (Haupt-)Punkt bekommt. Bei halben Punkten den Hauptgewinner setzen und das in notes erwähnen.
- "Eddi"/"Eddie" = Etienne.
- confidence "high": Sieger explizit benannt.
- confidence "medium": Sieger durch klare kontextuelle Bestätigung ("ja, genau") ableitbar.
- confidence "low": Mehrdeutig oder fraktionale Punkte.
- skipped=true nur wenn definitiv KEIN Rätsel in der Folge ist (Live-Folge, reine Specialfolge, Q&A). Im Zweifel skipped=false und konkret notes erklären.
- notes: Bei halben Punkten, fraktionalen Punkten oder Unsicherheit kurze Begründung.
- Antworte AUSSCHLIESSLICH mit dem JSON. Keine einleitenden oder abschließenden Worte.`;

function parseFilename(name) {
  const base = name.replace(/\.txt$/, "");
  const patterns = [
    /^#?\s*Folge\s*(\d+)\s*[-:]\s*(.+)$/i,
    /^#\s*(\d+)\s*:\s*(.+)$/,
    /^#\s*(\d+)\s+(.+)$/,
    /^(\d+)\s*:\s*(.+)$/,
  ];
  for (const re of patterns) {
    const m = base.match(re);
    if (m) return { number: parseInt(m[1], 10), title: m[2].trim() };
  }
  return null;
}

function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const args = [
      "-p",
      "--model", MODEL,
      "--system-prompt", SYSTEM,
      "--tools", "",
      "--output-format", "json",
      "--no-session-persistence",
      "--disable-slash-commands",
    ];
    // Run in /tmp so claude doesn't auto-load this repo's CLAUDE.md / git context.
    const child = spawn("claude", args, {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: "/tmp",
    });
    let out = "", err = "";
    child.stdout.on("data", (c) => (out += c.toString()));
    child.stderr.on("data", (c) => (err += c.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`claude exit ${code}: ${err.slice(0, 500)}`));
      try {
        const wrapper = JSON.parse(out);
        // claude -p --output-format json wraps the assistant text in `.result`
        resolve(typeof wrapper.result === "string" ? wrapper.result : out);
      } catch {
        resolve(out.trim());
      }
    });
    child.stdin.end(prompt);
  });
}

function extractJson(text) {
  // Find first { ... } block
  const start = text.indexOf("{");
  if (start === -1) return null;
  // Naive matching: find the matching closing brace
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)); }
        catch { return null; }
      }
    }
  }
  return null;
}

async function processEpisode(file, num) {
  const filePath = join(TRANSCRIPT_DIR, file);
  const text = await readFile(filePath, "utf-8");
  const cleaned = text.replace(/\s+/g, " ").trim();
  // Send the entire episode (truncated only if absurdly long).
  const body = cleaned.length > MAX_CHARS ? cleaned.slice(0, MAX_CHARS) : cleaned;
  const truncatedNote = cleaned.length > MAX_CHARS
    ? `(gekürzt auf ${MAX_CHARS} Zeichen von ${cleaned.length})`
    : `(${cleaned.length} Zeichen, komplette Folge)`;

  const prompt = `Hier ist das komplette Transkript von Folge #${num} ${truncatedNote}. Suche im ganzen Text nach dem Rätsel-Segment – das kann am Anfang, in der Mitte oder am Ende sein. Extrahiere die Rätsel-Infos im geforderten JSON-Format:

---
${body}
---`;

  const raw = await callClaude(prompt);
  const json = extractJson(raw);
  if (!json) {
    console.warn(`  ! Folge ${num}: konnte Antwort nicht als JSON parsen. Rohantwort:`);
    console.warn(`  ${raw.slice(0, 300)}`);
    return null;
  }
  return json;
}

function pickDefaultEpisodes() {
  // 15 spread episodes
  return [2, 10, 25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325];
}

async function main() {
  const args = process.argv.slice(2);
  let targets;

  const files = await readdir(TRANSCRIPT_DIR);
  const byNumber = new Map();
  for (const f of files) {
    if (!f.endsWith(".txt")) continue;
    const p = parseFilename(f);
    if (p) byNumber.set(p.number, { file: f, ...p });
  }

  if (args.includes("--all")) {
    targets = [...byNumber.keys()].sort((a, b) => a - b);
  } else if (args.length > 0) {
    targets = args.map((s) => parseInt(s, 10)).filter((n) => !isNaN(n));
  } else {
    targets = pickDefaultEpisodes();
  }

  const concurrency = parseInt(process.env.CONCURRENCY || "6", 10);
  console.log(`Verarbeite ${targets.length} Folgen mit Modell ${MODEL} (concurrency=${concurrency})...`);

  let overrides = {};
  if (existsSync(OVERRIDES)) {
    overrides = JSON.parse(readFileSync(OVERRIDES, "utf-8"));
  }

  const skipDone = process.env.SKIP_DONE === "1";
  if (skipDone) {
    const before = targets.length;
    targets = targets.filter((n) => {
      const o = overrides[String(n)];
      return !(o && o._auto && o._model === MODEL);
    });
    console.log(`  ${before - targets.length} bereits verarbeitete Folgen übersprungen (SKIP_DONE=1).`);
  }

  let processed = 0, withWinners = 0, skippedCount = 0, errored = 0;
  const startTime = Date.now();
  const queue = [...targets];
  let saveTimer = null;

  const scheduleSave = () => {
    if (saveTimer) return;
    saveTimer = setTimeout(async () => {
      saveTimer = null;
      await writeFile(OVERRIDES, JSON.stringify(overrides, null, 2));
    }, 500);
  };

  async function worker(id) {
    while (queue.length > 0) {
      const num = queue.shift();
      const meta = byNumber.get(num);
      if (!meta) {
        console.warn(`  [w${id}] ! Folge ${num} nicht gefunden`);
        continue;
      }
      try {
        const result = await processEpisode(meta.file, num);
        if (!result) {
          console.log(`  [w${id}] Folge ${num}: FEHLER (kein JSON)`);
          errored++;
          continue;
        }
        overrides[String(num)] = {
          winner: result.winner,
          question: result.question,
          answer: result.answer,
          skipped: !!result.skipped,
          notes: result.notes || null,
          _auto: true,
          _confidence: result.confidence,
          _model: MODEL,
        };
        processed++;
        if (result.skipped) {
          skippedCount++;
          console.log(`  [w${id}] Folge ${num.toString().padStart(3)} (${meta.title.slice(0, 35)}): SKIPPED`);
        } else if (result.winner) {
          withWinners++;
          console.log(`  [w${id}] Folge ${num.toString().padStart(3)} (${meta.title.slice(0, 35)}): ✓ ${result.winner} (${result.confidence})`);
        } else {
          console.log(`  [w${id}] Folge ${num.toString().padStart(3)} (${meta.title.slice(0, 35)}): ? unklar (${result.confidence})`);
        }
        scheduleSave();
      } catch (e) {
        console.log(`  [w${id}] Folge ${num}: FEHLER – ${e.message.slice(0, 100)}`);
        errored++;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i + 1)));
  if (saveTimer) clearTimeout(saveTimer);
  await writeFile(OVERRIDES, JSON.stringify(overrides, null, 2));

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nFertig in ${elapsed}s (${(elapsed / Math.max(processed, 1)).toFixed(1)}s pro Folge).`);
  console.log(`  Verarbeitet: ${processed}`);
  console.log(`  Mit Sieger:  ${withWinners}`);
  console.log(`  Geskippt:    ${skippedCount}`);
  console.log(`  Unklar:      ${processed - withWinners - skippedCount}`);
  console.log(`  Fehler:      ${errored}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
