#!/usr/bin/env node
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TRANSCRIPT_DIR = join(ROOT, "transscript");
const DATA_DIR = join(ROOT, "data");
const OUT_FILE = join(DATA_DIR, "episodes.json");
const OVERRIDES_FILE = join(DATA_DIR, "raetsel-overrides.json");
const GAGS_FILE = join(DATA_DIR, "running-gags.json");

// Stop words for top-word extraction (German + casual filler words)
const STOP_WORDS = new Set([
  // Articles & pronouns
  "und","oder","aber","auch","ein","eine","einen","einem","einer","eines","das","der","die","dem","den","des",
  "ich","mich","mir","du","dich","dir","er","ihm","ihn","sie","ihr","ihre","ihren","ihrem","ihrer","ihres",
  "es","wir","uns","unser","unsere","unseren","unserem","unserer","unsereres","euch","euer","eure","euren",
  "sich","mein","meine","meinen","meinem","meiner","meines","dein","deine","deinen","deinem","deiner",
  "sein","seine","seinen","seinem","seiner","seines",
  // Verbs (sein / haben / werden / Modal)
  "ist","sind","war","waren","bin","bist","seid","seien",
  "hat","habe","haben","hast","habt","hatte","hatten","hättest","hätten","hätte",
  "wird","werden","wurde","wurden","wäre","wären","worden",
  "kann","kannst","können","könnte","könnten","konnte","konnten","könnt","muss","müssen","mussten","müsste","müssen","müsst","musst",
  "sollte","sollten","soll","sollst","sollt","will","willst","wollen","wollte","wollten","wollt","mag","möchte","möchten",
  "tun","tue","tut","getan","geht","ging","gingen","gegangen","gehst","gehen","komm","kommt","kommen","kam","kamen","gekommen",
  "macht","mach","machen","gemacht","mache","machst","machte","machten","sagt","sage","sagen","gesagt","sagte","sagten","sagst",
  "gibt","geben","gab","gegeben","steht","stand","standen","sieht","sehen","sah","gesehen","find","finde","findet","finden","gefunden","fand",
  "denken","denkst","dachte","dachten","weiß","weißt","wisst","wissen","wusste","wussten","gewusst","heißt","heißen","hieß","heiß",
  "schauen","schau","schaut","gucken","guck","guckst","gucke","glauben","glaube","glaubst","glaubt","glaubte","liegt","liegen","lag","lagen",
  "darf","dürfen","durfte","dürfte","möchten",
  // Prepositions
  "in","im","auf","an","am","zu","zur","zum","von","vom","mit","bei","beim","für","aus","nach","über","unter","vor","durch","gegen","ohne","um","bis","seit","während","zwischen","gegenüber",
  // Conjunctions & particles
  "nicht","kein","keine","keinen","keinem","keiner","keines","nichts","mehr","weniger","ganz","sehr","etwas","etwa","ungefähr",
  "so","wenn","weil","dass","denn","wie","was","wer","wo","wann","warum","wieso","welche","welcher","welches","welchen",
  "schon","noch","mal","eben","halt","ja","nein","doch","gut","ach","oh","äh","ähm","uh","tja","hä","hm","mhm","mh","aha","oha","oho",
  "man","jetzt","dann","da","hier","heute","morgen","gestern","immer","oft","manchmal","nie","einmal","zweimal",
  "also","klar","total","wirklich","quasi","irgendwie","eigentlich","vielleicht","trotzdem","überhaupt","sondern","obwohl","damit","damals","dafür","darauf","darum","darüber","dazu","dabei","danach","davor","deshalb","deswegen","sowas","sowieso",
  // Common filler words from podcasts
  "wieder","einfach","natürlich","bisschen","alle","alles","viel","viele","vieles","richtig","genau","nochmal","musst","hätte","würde","würden","würdest","würdet","würd","weiter","weitere","weiteren","weiteres","wahrscheinlich","scheinbar","gerade","echt","leider","sicher","sicherlich","glaub","weniger","weiß","weisst",
  "frage","fragen","fragte","gefragt","antwort","antworten","beispiel","sache","sachen","ding","dinge","leute","mensch","menschen","punkt","punkte","stelle","stellen","zeit","jahre","jahren","jahr","tage","tag","tagen","fall","fälle",
  "irgendwann","irgendwas","irgendwo","überall","nirgendwo","jemand","jemanden","niemand","jeder","jede","jeden","jedem","jeder","jedes","selber","selbst","alleine","allein","zusammen","nochmal","mehrmals",
  "naja","najaja","tatsächlich","grunde","im","art","weise","prinzip","prinzipiell","grundsätzlich",
  // English filler that slips in
  "thats","gehts","of","the","my","a","i","it","that","you","we","be","he","she","they","this","yeah","ok","okay","cool","yes","no","what","when","just","like","really","very","so","one","two","three",
  // Numbers and single chars
  "1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","20","30","40","50","60","100","1000",
  "halt","zwar","schließlich","trotzdem",
]);

const HOST_NAMES = {
  etienne: ["Etienne","Eddi","Eddie"],
  jochen: ["Jochen"],
  georg: ["Georg"],
};

// Parse episode number and title from filename
function parseFilename(filename) {
  const name = filename.replace(/\.txt$/, "");

  // Patterns:
  // "#1: Title"
  // "#100: Title"
  // "# 184: Title"
  // "Folge 153 - Title"
  // "Folge 154: Title"
  // "290: Title"
  // "#Folge 141:  Eddi..."
  const patterns = [
    /^#?\s*Folge\s*(\d+)\s*[-:]\s*(.+)$/i,
    /^#\s*(\d+)\s*:\s*(.+)$/,
    /^#\s*(\d+)\s+(.+)$/,
    /^(\d+)\s*:\s*(.+)$/,
  ];

  for (const re of patterns) {
    const m = name.match(re);
    if (m) {
      return {
        number: parseInt(m[1], 10),
        title: m[2].trim().replace(/^["']|["']$/g, "").replace(/\s+/g, " "),
      };
    }
  }
  return null;
}

// Heuristic: split text into approximate sentences
function splitSentences(text) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ])/);
}

// Build a slug
function slugify(str) {
  return str
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Count host mentions
function countHostMentions(text) {
  const counts = { etienne: 0, jochen: 0, georg: 0 };
  for (const [host, names] of Object.entries(HOST_NAMES)) {
    for (const n of names) {
      const re = new RegExp(`\\b${n}\\b`, "gi");
      const m = text.match(re);
      counts[host] += m ? m.length : 0;
    }
  }
  return counts;
}

// Heuristically extract the Rätsel section
// Strategy: Find last occurrence of "Rätsel" / "Frage" in last 30% of text,
// take from there to end as the Rätsel section. Cap at 4000 chars.
function extractRaetselSection(text) {
  const lastThirdStart = Math.floor(text.length * 0.7);
  const lastThird = text.slice(lastThirdStart);

  const keywords = [
    /\bR(ä|ae)tsel\b/i,
    /\bFrage\s+(an|für|der|des|von)\b/i,
    /\bich\s+habe\s+ein\s+R(ä|ae)tsel\b/i,
    /\bich\s+habe\s+eine\s+Frage\b/i,
    /\bMein\s+R(ä|ae)tsel\b/i,
    /\bGeorgs?\s+(R(ä|ae)tsel|Frage)\b/i,
    /\bAm\s+Ende\s+der\s+Folge\b/i,
  ];

  let bestIdx = -1;
  for (const re of keywords) {
    const m = lastThird.search(re);
    if (m > -1) {
      const absoluteIdx = lastThirdStart + m;
      if (bestIdx === -1 || absoluteIdx < bestIdx) bestIdx = absoluteIdx;
    }
  }

  if (bestIdx === -1) {
    // Fall back to last 2500 chars
    const fallback = text.slice(Math.max(0, text.length - 2500));
    return { excerpt: fallback, found: false, startIndex: text.length - 2500 };
  }

  // Take from bestIdx to end, capped at 4000 chars
  let excerpt = text.slice(bestIdx, bestIdx + 4000);
  return { excerpt, found: true, startIndex: bestIdx };
}

// Heuristic: detect who got a "Punkt"
// We look for explicit Punkt-attribution patterns. Since transcripts have no
// speaker labels we can't reliably resolve "du"/"er" pronouns, so we only
// trust patterns that name a host explicitly.
function heuristicWinner(raetselExcerpt) {
  const NAMES = "(Etienne|Eddi|Eddie|Jochen|Georg)";
  const winPatterns = [
    new RegExp(`Punkt\\s+(?:geht\\s+(?:an|f(?:ü|ue)r)|f(?:ü|ue)r)\\s+${NAMES}`, "i"),
    new RegExp(`${NAMES}\\s+(?:bekommt|kriegt|hat|holt|kassiert)\\s+(?:einen|den)?\\s*Punkt`, "i"),
    new RegExp(`${NAMES},?\\s+du\\s+hast\\s+(?:einen|den)\\s*Punkt`, "i"),
    new RegExp(`${NAMES}\\s+gewinnt(?:\\s+den)?(?:\\s+Punkt)?`, "i"),
    new RegExp(`(?:Gewonnen\\s+hat|Sieger\\s+ist)\\s+${NAMES}`, "i"),
    new RegExp(`${NAMES}\\s+hat\\s+(?:das|es)\\s+gel(?:ö|oe)st`, "i"),
    new RegExp(`hat\\s+${NAMES}\\s+gel(?:ö|oe)st`, "i"),
    new RegExp(`Punkt\\s+(?:an|f(?:ü|ue)r)\\s+${NAMES}`, "i"),
    new RegExp(`${NAMES}\\s+ist\\s+der\\s+Sieger`, "i"),
  ];
  for (const re of winPatterns) {
    const m = raetselExcerpt.match(re);
    if (m) {
      const name = m[1].toLowerCase();
      if (name === "eddi" || name === "eddie") return "etienne";
      return name;
    }
  }
  return null;
}

// Top words (for fun)
function topWords(text, n = 10) {
  const words = text
    .toLowerCase()
    .replace(/[^\wäöüß\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
  const counts = new Map();
  for (const w of words) counts.set(w, (counts.get(w) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([word, count]) => ({ word, count }));
}

// Heuristic: count laughs (lols), "Quatsch", swear words, "Tschüss"
function funCounts(text) {
  const patterns = {
    haha: /\b(haha\w*|hehe\w*)\b/gi,
    quatsch: /\bQuatsch\b/gi,
    cool: /\bcool\b/gi,
    geil: /\bgeil\w*\b/gi,
    krass: /\bkrass\b/gi,
    digga: /\bDigga\b/gi,
    alter: /\b(Alter|Alta)\b/gi,
    scheisse: /\b(Schei(?:ß|ss)e|Scheiß\w*)\b/gi,
    leute: /\bLeute\b/gi,
    tschuess: /\b(Tsch(ü|ue)ss|Bye)\b/gi,
    podcast: /\bPodcast\b/gi,
    pommes: /\bPommes\b/gi,
    nettetal: /\bNettetal\b/gi,
    lobberich: /\bLobberich\b/gi,
    nordfriese: /\bNordfriese\b/gi,
  };
  const out = {};
  for (const [k, re] of Object.entries(patterns)) {
    const m = text.match(re);
    out[k] = m ? m.length : 0;
  }
  return out;
}

async function main() {
  console.log("Lese Transkript-Dateien...");
  const files = (await readdir(TRANSCRIPT_DIR)).filter((f) => f.endsWith(".txt"));
  console.log(`  ${files.length} Dateien gefunden.`);

  // Load manual overrides
  let overrides = {};
  if (existsSync(OVERRIDES_FILE)) {
    overrides = JSON.parse(readFileSync(OVERRIDES_FILE, "utf-8"));
    console.log(`  ${Object.keys(overrides).length} manuelle Overrides geladen.`);
  }

  // Load running gags definitions
  let gagDefs = {};
  if (existsSync(GAGS_FILE)) {
    gagDefs = JSON.parse(readFileSync(GAGS_FILE, "utf-8"));
  }
  // Pre-compile gag patterns
  const gagPatterns = {};
  for (const [key, gag] of Object.entries(gagDefs)) {
    if (key.startsWith("_") || !gag.pattern) continue;
    gagPatterns[key] = new RegExp(gag.pattern, "i");
  }
  // Per-gag accumulator: { episodes: [{number, title}], totalMentions: N }
  const gagStats = {};
  for (const key of Object.keys(gagPatterns)) {
    gagStats[key] = { episodes: [], totalMentions: 0 };
  }

  const episodes = [];
  let parseFailures = 0;

  for (const file of files) {
    const parsed = parseFilename(file);
    if (!parsed) {
      parseFailures++;
      console.warn(`  ! Konnte Folgennummer nicht parsen: ${file}`);
      continue;
    }

    const filePath = join(TRANSCRIPT_DIR, file);
    const text = await readFile(filePath, "utf-8");
    const cleaned = text.replace(/\s+/g, " ").trim();
    const wordCount = cleaned.split(/\s+/).length;
    const charCount = cleaned.length;
    const sentences = splitSentences(cleaned);

    const hostMentions = countHostMentions(cleaned);
    const raetsel = extractRaetselSection(cleaned);
    const heuristicW = heuristicWinner(raetsel.excerpt);
    const top = topWords(cleaned, 15);
    const fun = funCounts(cleaned);

    // Tally running-gag mentions for this episode
    const gagsInEp = [];
    for (const [key, re] of Object.entries(gagPatterns)) {
      const globalRe = new RegExp(re.source, "gi");
      const matches = cleaned.match(globalRe);
      if (matches && matches.length) {
        gagStats[key].totalMentions += matches.length;
        gagStats[key].episodes.push({
          number: parsed.number,
          title: parsed.title,
          mentions: matches.length,
        });
        gagsInEp.push(key);
      }
    }

    // Take a teaser: first 2-3 sentences
    const teaser = sentences.slice(0, 3).join(" ").slice(0, 400);

    const override = overrides[String(parsed.number)] || {};

    episodes.push({
      number: parsed.number,
      title: parsed.title,
      slug: slugify(`${parsed.number}-${parsed.title}`),
      filename: file,
      wordCount,
      charCount,
      sentenceCount: sentences.length,
      teaser,
      hostMentions,
      raetsel: {
        excerpt: raetsel.excerpt,
        autoDetected: raetsel.found,
        startIndex: raetsel.startIndex,
        heuristicWinner: heuristicW,
        // Override / annotation fields
        winner: override.winner || null,
        question: override.question || null,
        answer: override.answer || null,
        skipped: override.skipped || false,
        notes: override.notes || null,
        autoExtracted: override._auto || false,
        confidence: override._confidence || null,
        model: override._model || null,
      },
      topWords: top,
      funCounts: fun,
      gags: gagsInEp,
    });
  }

  episodes.sort((a, b) => a.number - b.number);

  // Sort gag episode lists by number ascending
  for (const k of Object.keys(gagStats)) {
    gagStats[k].episodes.sort((a, b) => a.number - b.number);
  }

  // Compute aggregate stats
  const totalWords = episodes.reduce((s, e) => s + e.wordCount, 0);
  const totalChars = episodes.reduce((s, e) => s + e.charCount, 0);
  const avgWords = Math.round(totalWords / episodes.length);

  // Winner tally — only count winners we trust:
  //   - manual override (no _auto flag) → always count
  //   - auto-extracted with confidence high/medium → count
  //   - heuristic match → count
  // Low-confidence auto results don't count toward the leaderboard.
  const winners = { etienne: 0, jochen: 0, georg: 0, unknown: 0 };
  let skippedCount = 0;
  for (const e of episodes) {
    if (e.raetsel.skipped) { skippedCount++; continue; }
    let w = null;
    if (e.raetsel.winner) {
      const conf = e.raetsel.confidence;
      const isAuto = e.raetsel.autoExtracted;
      if (!isAuto || conf === "high" || conf === "medium") {
        w = e.raetsel.winner;
      }
    } else if (e.raetsel.heuristicWinner) {
      w = e.raetsel.heuristicWinner;
    }
    if (w && winners[w] !== undefined) winners[w]++;
    else winners.unknown++;
  }

  // Aggregate host mentions
  const totalMentions = { etienne: 0, jochen: 0, georg: 0 };
  for (const e of episodes) {
    totalMentions.etienne += e.hostMentions.etienne;
    totalMentions.jochen += e.hostMentions.jochen;
    totalMentions.georg += e.hostMentions.georg;
  }

  // Top global words
  const globalWordCounts = new Map();
  for (const e of episodes) {
    for (const { word, count } of e.topWords) {
      globalWordCounts.set(word, (globalWordCounts.get(word) || 0) + count);
    }
  }
  const topGlobal = [...globalWordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([word, count]) => ({ word, count }));

  // Longest / shortest episodes
  const sortedByLen = [...episodes].sort((a, b) => b.wordCount - a.wordCount);
  const longest = sortedByLen.slice(0, 5).map((e) => ({ number: e.number, title: e.title, wordCount: e.wordCount }));
  const shortest = sortedByLen.slice(-5).reverse().map((e) => ({ number: e.number, title: e.title, wordCount: e.wordCount }));

  // Aggregate fun counts
  const totalFun = {};
  for (const e of episodes) {
    for (const [k, v] of Object.entries(e.funCounts)) {
      totalFun[k] = (totalFun[k] || 0) + v;
    }
  }

  // Episode with most laughter (haha)
  const mostLaughs = [...episodes].sort((a, b) => b.funCounts.haha - a.funCounts.haha).slice(0, 5)
    .map((e) => ({ number: e.number, title: e.title, count: e.funCounts.haha }));

  // Episode with most "Quatsch"
  const mostQuatsch = [...episodes].sort((a, b) => b.funCounts.quatsch - a.funCounts.quatsch).slice(0, 5)
    .map((e) => ({ number: e.number, title: e.title, count: e.funCounts.quatsch }));

  const stats = {
    episodeCount: episodes.length,
    skippedRaetselCount: skippedCount,
    totalWords,
    totalChars,
    avgWords,
    winners,
    totalMentions,
    topGlobal,
    longest,
    shortest,
    mostLaughs,
    mostQuatsch,
    totalFun,
    estimatedHours: Math.round(totalWords / 130 / 60), // 130 wpm spoken
  };

  // Build a slim version for fast lookup (no raetsel excerpts; loaded per-episode)
  const slim = episodes.map((e) => ({
    number: e.number,
    title: e.title,
    slug: e.slug,
    wordCount: e.wordCount,
    teaser: e.teaser,
    raetselWinner: e.raetsel.winner || e.raetsel.heuristicWinner,
    raetselSkipped: e.raetsel.skipped,
  }));

  // Merge gag definitions with extracted stats
  const gagsOut = {};
  for (const [key, def] of Object.entries(gagDefs)) {
    if (key.startsWith("_")) continue;
    gagsOut[key] = {
      ...def,
      key,
      episodeCount: gagStats[key]?.episodes.length || 0,
      totalMentions: gagStats[key]?.totalMentions || 0,
      episodes: gagStats[key]?.episodes || [],
    };
  }

  // Write episodes index + full data
  await writeFile(join(DATA_DIR, "episodes-slim.json"), JSON.stringify(slim, null, 0));
  await writeFile(join(DATA_DIR, "episodes.json"), JSON.stringify(episodes, null, 0));
  await writeFile(join(DATA_DIR, "stats.json"), JSON.stringify(stats, null, 2));
  await writeFile(join(DATA_DIR, "gags-resolved.json"), JSON.stringify(gagsOut, null, 2));

  console.log(`\n✓ Verarbeitet: ${episodes.length} Folgen`);
  console.log(`  Parse-Fehler: ${parseFailures}`);
  console.log(`  Gesamtwörter: ${totalWords.toLocaleString("de-DE")}`);
  console.log(`  Geschätzte Hörzeit: ~${stats.estimatedHours}h`);
  console.log(`  Rätsel-Sieger (heuristisch): Etienne=${winners.etienne}, Jochen=${winners.jochen}, Georg=${winners.georg}, unbekannt=${winners.unknown}`);
  console.log(`  Running Gags: ${Object.values(gagsOut).map(g => `${g.name}=${g.episodeCount}`).join(", ")}`);
  console.log(`  Daten geschrieben nach data/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
