#!/usr/bin/env node
// Extracts business/startup ideas from podcast episodes via claude CLI.
// Two-stage: (1) pre-filter episodes that probably contain ideas via keyword
// search, (2) AI extracts structured ideas from the matched ones.
//
// Output: data/business-ideas.json keyed by episode number.

import { readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TRANSCRIPT_DIR = join(ROOT, "transscript");
const OUT_FILE = join(ROOT, "data", "business-ideas.json");

const MODEL = "claude-haiku-4-5-20251001";
const MAX_CHARS = 120000;

const IDEA_KEYWORDS = [
  /\b(Gesch(ä|ae)ftsidee|Start[- ]?up|Business[- ]?Idee|Million(ä|ae)r|Erfindung)\b/i,
  /\b(eine?\s+Idee|ich\s+habe\s+eine\s+Idee|wir\s+sollten|wir\s+m(ü|ue)ssten)\b/i,
  /\b(verkaufen|produzieren|Patent|patentieren|gr(ü|ue)nden)\b/i,
  /\b(damit\s+wird\s+man\s+reich|Geld\s+verdienen)\b/i,
];

const SYSTEM = `Du bist ein Daten-Extraktions-Bot. Du analysierst das komplette Transkript einer deutschsprachigen Podcast-Folge ("Podcast ohne richtigen Namen" mit Etienne Gardé, Jochen Dominicus, Georg Zaal) und identifizierst, ob darin eine oder mehrere echte Geschäfts-/Start-up-Ideen besprochen werden.

ECHT bedeutet: Die Hosts diskutieren ernsthaft (auch wenn humorvoll) eine konkrete Geschäftsidee – z.B. ein Produkt, einen Service, eine Erfindung, eine App. Reine Witze oder Quatsch-Ideen ohne Substanz NICHT zählen.

Antworte AUSSCHLIESSLICH mit JSON, ohne Markdown:
{
  "hasIdea": boolean,
  "ideas": [
    {
      "name": "kurzer Name (max 60 Zeichen)",
      "summary": "1-2 Sätze, was die Idee genau ist",
      "originator": "etienne"|"jochen"|"georg"|null,
      "viability": "ernsthaft"|"halbernst"|"quatsch",
      "category": "App/Software"|"Produkt"|"Service"|"Erfindung"|"Sonstiges"
    }
  ],
  "notes": string|null
}

Regeln:
- Wenn keine Idee: {"hasIdea": false, "ideas": [], "notes": "kurz warum"}
- Wenn mehrere Ideen: bis zu 3 listen.
- "Eddi"/"Eddie" = Etienne.
- Antworte AUSSCHLIESSLICH mit dem JSON.`;

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

function hasKeyword(text) {
  return IDEA_KEYWORDS.some((re) => re.test(text));
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
    const child = spawn("claude", args, {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: "/tmp",
    });
    let out = "", err = "";
    child.stdout.on("data", (c) => (out += c.toString()));
    child.stderr.on("data", (c) => (err += c.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`claude exit ${code}: ${err.slice(0, 300)}`));
      try {
        const wrapper = JSON.parse(out);
        resolve(typeof wrapper.result === "string" ? wrapper.result : out);
      } catch { resolve(out.trim()); }
    });
    child.stdin.end(prompt);
  });
}

function extractJson(text) {
  const start = text.indexOf("{");
  if (start === -1) return null;
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
  const text = await readFile(join(TRANSCRIPT_DIR, file), "utf-8");
  const cleaned = text.replace(/\s+/g, " ").trim();
  const body = cleaned.length > MAX_CHARS ? cleaned.slice(0, MAX_CHARS) : cleaned;
  const prompt = `Hier ist das komplette Transkript von Folge #${num}. Suche nach Geschäfts-/Start-up-Ideen:\n\n---\n${body}\n---`;
  const raw = await callClaude(prompt);
  return extractJson(raw);
}

async function main() {
  console.log("Lese Transkript-Dateien...");
  const files = (await readdir(TRANSCRIPT_DIR)).filter((f) => f.endsWith(".txt"));

  // Build map
  const byNumber = new Map();
  for (const f of files) {
    const p = parseFilename(f);
    if (p) byNumber.set(p.number, { file: f, ...p });
  }
  const numbers = [...byNumber.keys()].sort((a, b) => a - b);

  // Pre-filter
  console.log("Stage 1: Keyword pre-filter…");
  const candidates = [];
  for (const num of numbers) {
    const meta = byNumber.get(num);
    const text = await readFile(join(TRANSCRIPT_DIR, meta.file), "utf-8");
    if (hasKeyword(text)) candidates.push(num);
  }
  console.log(`  ${candidates.length} von ${numbers.length} Folgen mit Idee-Keywords.`);

  // Load existing
  let existing = {};
  if (existsSync(OUT_FILE)) {
    existing = JSON.parse(readFileSync(OUT_FILE, "utf-8"));
  }

  // CLI args allow overriding
  const args = process.argv.slice(2);
  let targets = candidates;
  if (args.includes("--all")) targets = numbers;
  else if (args.length > 0 && !args[0].startsWith("--")) {
    targets = args.map((s) => parseInt(s, 10)).filter((n) => !isNaN(n));
  }
  if (process.env.SKIP_DONE === "1") {
    targets = targets.filter((n) => !existing[String(n)]);
    console.log(`  ${targets.length} verbleibend nach SKIP_DONE.`);
  }

  // Stage 2: AI extraction
  const concurrency = parseInt(process.env.CONCURRENCY || "6", 10);
  console.log(`Stage 2: AI-Extraktion ${targets.length} Folgen (concurrency=${concurrency})…`);

  const queue = [...targets];
  let processed = 0, withIdeas = 0;
  const startTime = Date.now();

  let saveTimer = null;
  const scheduleSave = () => {
    if (saveTimer) return;
    saveTimer = setTimeout(async () => {
      saveTimer = null;
      await writeFile(OUT_FILE, JSON.stringify(existing, null, 2));
    }, 500);
  };

  async function worker(id) {
    while (queue.length > 0) {
      const num = queue.shift();
      const meta = byNumber.get(num);
      if (!meta) continue;
      try {
        const result = await processEpisode(meta.file, num);
        if (!result) {
          console.log(`  [w${id}] #${num}: FEHLER (kein JSON)`);
          continue;
        }
        existing[String(num)] = {
          ...result,
          episodeNumber: num,
          episodeTitle: meta.title,
          _model: MODEL,
        };
        processed++;
        if (result.hasIdea && result.ideas && result.ideas.length) {
          withIdeas++;
          const names = result.ideas.map((i) => i.name).join(" / ");
          console.log(`  [w${id}] #${String(num).padStart(3)} ${meta.title.slice(0, 30).padEnd(30)}: ✓ ${names.slice(0, 60)}`);
        } else {
          console.log(`  [w${id}] #${String(num).padStart(3)} ${meta.title.slice(0, 30).padEnd(30)}: – keine Idee`);
        }
        scheduleSave();
      } catch (e) {
        console.log(`  [w${id}] #${num}: FEHLER – ${e.message.slice(0, 100)}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i + 1)));
  if (saveTimer) clearTimeout(saveTimer);
  await writeFile(OUT_FILE, JSON.stringify(existing, null, 2));

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nFertig in ${elapsed}s.`);
  console.log(`  Verarbeitet:    ${processed}`);
  console.log(`  Mit Idee:       ${withIdeas}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
