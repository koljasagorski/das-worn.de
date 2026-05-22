#!/usr/bin/env node
// Import official Rätsel data from the PDF (extracted to a text file)
// and write it to data/raetsel-overrides.json.
//
// The PDF is structured as a wide table. We parse the layout-preserved
// text output of pdftotext and reconstruct rows.

import { readFile, writeFile } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC_FILE = process.argv[2] || "/tmp/raetsel-layout.txt";
const OUT_FILE = join(ROOT, "data", "raetsel-overrides.json");

const DATE_RE = /^\s+(\d{2}\.\d{2}\.\d{4})\s/;
const TITLE_RE = /^\s*(#\s*\d+:?.*?)(?:\s{3,}|$)/;

function normalizeWinner(s) {
  if (!s) return null;
  s = s.trim().toLowerCase();
  if (s.includes("jochen")) return "jochen";
  if (s.includes("etienne") || s.includes("eddi")) return "etienne";
  if (s.includes("george") || s.includes("georg")) return "georg";
  if (s.includes("beiden") || s.includes("beide")) return "beiden";
  if (s.includes("nicht gelöst") || s.includes("nicht geloest")) return null; // unsolved
  return null;
}

function parseEpisodeNumber(title) {
  const m = title.match(/#\s*(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

async function main() {
  const text = await readFile(SRC_FILE, "utf-8");
  const lines = text.split("\n");

  // Group lines into "rows" — a row starts when a date appears at the start.
  const rows = [];
  let current = null;
  for (const line of lines) {
    if (!line.trim()) continue;
    if (DATE_RE.test(line)) {
      if (current) rows.push(current);
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) rows.push(current);

  console.log(`Gefunden: ${rows.length} Rätsel-Zeilen.`);

  // Build column positions from the first row's structure by detecting
  // the column anchors. We use the title as the anchor.
  // Actually we'll process each row by finding the title, then splitting by
  // multi-space gaps.
  const parsedRows = [];
  for (const rowLines of rows) {
    // Concatenate all lines, preserving spacing — but cell content wraps
    // across lines in different columns. Easier: process the first line
    // by splitting on 3+ spaces, then merge continuation lines into the
    // correct cell.
    const first = rowLines[0];
    // Split first line into fields by 3+ spaces
    const fields = first.split(/\s{3,}/).map((s) => s.trim()).filter(Boolean);
    // Expected fields: [date, title, question, answer, ergebnis, raetseldauer, spielzeit, link]
    // But sometimes question + answer wrap; we'll need to handle that.
    if (fields.length < 5) continue;

    const date = fields[0];
    const title = fields[1];
    // Find the link field (starts with http)
    let linkIdx = fields.findIndex((f) => /^https?:\/\//.test(f));
    // Find duration fields (H:MM:SS format)
    let durIdx = -1;
    for (let i = 0; i < fields.length; i++) {
      if (/^\d{1,2}:\d{2}:\d{2}$/.test(fields[i])) { durIdx = i; break; }
    }
    // result is right before durIdx
    const ergebnisIdx = durIdx > 0 ? durIdx - 1 : -1;
    if (ergebnisIdx === -1) {
      console.warn(`  ! konnte Spalten nicht finden: ${title}`);
      continue;
    }
    // Question = field[2], Answer = field[3..ergebnisIdx-1]
    const question = fields.slice(2, ergebnisIdx === 3 ? 3 : ergebnisIdx - (ergebnisIdx >= 4 ? 1 : 0))
      .join(" ");
    // Simpler approach: question is index 2, answer is indices 3..ergebnisIdx-1
    const questionParts = [fields[2] || ""];
    const answerParts = [];
    for (let i = 3; i < ergebnisIdx; i++) answerParts.push(fields[i]);
    const result = fields[ergebnisIdx] || "";
    const duration1 = fields[durIdx] || "";
    const link = linkIdx >= 0 ? fields[linkIdx] : null;

    // Merge continuation lines: detect which column they belong to by indentation.
    // Heuristic: a continuation line's content position tells us the column.
    // Simpler: append continuation chunks to the answer (most common wrap case).
    for (let i = 1; i < rowLines.length; i++) {
      const cont = rowLines[i].trim();
      if (!cont) continue;
      const contFields = rowLines[i].split(/\s{3,}/).map((s) => s.trim()).filter(Boolean);
      // Heuristic: small content → answer; if multiple chunks, distribute
      if (contFields.length === 1) {
        // Determine if it goes to question or answer based on indent of first non-space char
        const indent = rowLines[i].search(/\S/);
        // Question column starts ~75 chars in, answer ~155 chars in (rough)
        if (indent > 130 && indent < 280) {
          answerParts.push(contFields[0]);
        } else if (indent >= 60 && indent <= 130) {
          questionParts.push(contFields[0]);
        } else {
          answerParts.push(contFields[0]);
        }
      } else {
        for (let j = 0; j < contFields.length; j++) {
          // Best guess: continuation column field goes to whatever wraps
          // Append to answer by default
          answerParts.push(contFields[j]);
        }
      }
    }

    parsedRows.push({
      date,
      title,
      number: parseEpisodeNumber(title),
      question: questionParts.join(" ").replace(/\s+/g, " ").trim(),
      answer: answerParts.join(" ").replace(/\s+/g, " ").trim(),
      result,
      duration: duration1,
      link,
    });
  }

  // Group by episode number — some episodes have multiple Rätsel (#4 has Frage 1 & 2)
  const byEpisode = new Map();
  for (const r of parsedRows) {
    if (r.number == null) continue;
    if (!byEpisode.has(r.number)) byEpisode.set(r.number, []);
    byEpisode.get(r.number).push(r);
  }

  // Load existing overrides to preserve other fields
  let overrides = {};
  if (existsSync(OUT_FILE)) overrides = JSON.parse(readFileSync(OUT_FILE, "utf-8"));

  let count = 0;
  for (const [num, riddles] of byEpisode) {
    const winners = riddles.map((r) => normalizeWinner(r.result));
    // Primary winner for display
    const primaryWinner = winners.find((w) => w && w !== "beiden") || null;
    const allUnsolved = riddles.every((r) => normalizeWinner(r.result) === null && !/beiden/i.test(r.result));

    // Count points to match the official PDF tally: only full wins count
    // (Etienne / Jochen / Georg). "beiden" episodes are tracked separately
    // and not added to the main score.
    const points = { etienne: 0, jochen: 0, georg: 0 };
    let beidenCount = 0;
    for (const w of winners) {
      if (w === "beiden") beidenCount++;
      else if (w && points[w] != null) points[w] += 1;
    }

    const entry = {
      winner: primaryWinner,
      question: riddles.map((r) => r.question).filter(Boolean).join(" / "),
      answer: riddles.map((r) => r.answer).filter(Boolean).join(" / "),
      skipped: false,
      notes: riddles.length > 1
        ? `${riddles.length} Rätsel in dieser Folge. Sieger pro Frage: ${winners.map((w) => w || "—").join(", ")}.`
        : (allUnsolved ? "Nicht gelöst." : null),
      _source: "official-pdf-2026-05-22",
      _confidence: "high",
      _link: riddles[0].link || null,
      _date: riddles[0].date || null,
      _points: points,
      _beidenCount: beidenCount,
      _riddleCount: riddles.length,
    };
    if (winners.includes("beiden") && !entry.notes) {
      entry.notes = "Geteilter Punkt: beide bekommen je 0,5 Punkte.";
    }
    overrides[String(num)] = entry;
    count++;
  }

  await writeFile(OUT_FILE, JSON.stringify(overrides, null, 2));
  console.log(`\n✓ ${count} Folgen aus offizieller PDF nach data/raetsel-overrides.json geschrieben.`);

  // Print summary stats
  const tally = { etienne: 0, jochen: 0, georg: 0, beiden: 0, unsolved: 0 };
  for (const r of parsedRows) {
    const w = normalizeWinner(r.result);
    if (w === "beiden") tally.beiden++;
    else if (w === "etienne") tally.etienne++;
    else if (w === "jochen") tally.jochen++;
    else if (w === "georg") tally.georg++;
    else tally.unsolved++;
  }
  console.log(`Aus PDF gezählt (alle ${parsedRows.length} Fragen):`);
  console.log(`  Etienne: ${tally.etienne}`);
  console.log(`  Jochen:  ${tally.jochen}`);
  console.log(`  Georg:   ${tally.georg}`);
  console.log(`  beiden:  ${tally.beiden} (geteilte halbe Punkte)`);
  console.log(`  nicht gelöst: ${tally.unsolved}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
