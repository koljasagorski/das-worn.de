# das worn

**W**iki **O**hne **R**ichtigen **N**amen – ein inoffizielles Fan-Wiki zum *Podcast ohne richtigen Namen* mit Etienne Garde, Jochen und Georg. Läuft als Cloudflare Worker auf `das-worn.de`.

## Was drin ist

- **361 Folgen** aus dem `transscript/`-Ordner werden beim Build geparst.
- **Startseite** mit Schnellstatistiken und neuesten Folgen.
- **Folgenliste** mit Suche nach Titel oder Nummer.
- **Folgen-Detailseite** mit Wortzahl, Hörzeit-Schätzung, Host-Erwähnungen, Top-Wörtern, lustigen Zählern und einem auto-extrahierten Rätsel-Abschnitt.
- **Hosts-Seite** mit Kurzprofilen und Erwähnungs-Statistiken.
- **Rätsel & Punkte** mit Punktetabelle (Etienne/Jochen/Georg).
- **Statistik-Seite** mit Top-Wörtern, längsten/kürzesten Folgen, "lustigster" Folge, etc.
- **Random-Folge** – Würfel und lande auf einer beliebigen Folge.
- **JSON-API** unter `/api/episodes`, `/api/stats`, `/api/episode/:nr`.

## Setup

```bash
npm install
npm run build:data    # parst alle Transkripte → data/*.json
npm run dev           # startet lokalen Worker auf :8787
```

Deployment nach Cloudflare:

```bash
npm run deploy
```

Vorher: `npx wrangler login` und ggf. `name` in `wrangler.toml` anpassen.

## Wie werden die Daten generiert?

`scripts/build-data.mjs` liest alle Dateien aus `transscript/` und extrahiert:

- Folgennummer + Titel aus dem Dateinamen (verschiedene Patterns werden unterstützt).
- Wort- und Zeichenzahlen, geschätzte Hörzeit (130 Wörter/Min.).
- Erwähnungen je Host (Etienne/Eddi, Jochen, Georg).
- Top-Wörter pro Folge (nach Stopword-Filter).
- Lustige Zähler: Pommes, Quatsch, Lobberich, Nettetal, Nordfriese etc.
- Den letzten Abschnitt der Folge ab dem letzten "Rätsel"- oder "Frage"-Treffer als Rätsel-Kandidat.
- Heuristische Sieger-Erkennung über Patterns wie "Punkt für X" oder "X hat gelöst".

Die Heuristik fängt nur einen Bruchteil der Sieger, weil die Hosts frei sprechen ("Wir werden den im Nachhinein anerkennen, wenn du es wirklich gelöst hast"). Deshalb gibt es manuelle Overrides.

## Rätsel-Sieger automatisch extrahieren

`scripts/extract-raetsel.mjs` schickt jede Folge an Claude Haiku 4.5 und extrahiert Frage, Antwort und Sieger als JSON. Die Ergebnisse landen in `data/raetsel-overrides.json` mit einem `_auto: true`-Flag und einer `_confidence`-Angabe (`high` | `medium` | `low`).

```bash
# Pilotlauf auf 15 verteilten Folgen
node scripts/extract-raetsel.mjs

# Konkrete Folgen
node scripts/extract-raetsel.mjs 1 50 100

# Alle 361 Folgen (parallel mit 6 Workern, ~30-60 Min, ~$10)
CONCURRENCY=6 node scripts/extract-raetsel.mjs --all

# Nur fehlende Folgen verarbeiten
SKIP_DONE=1 node scripts/extract-raetsel.mjs --all
```

Voraussetzung: `claude` CLI installiert (Cloudflare-Workers-Web-Sessions haben das mit dabei).

Nur Sieger mit `confidence: high` oder `medium` werden in die Punktetabelle gezählt. Low-Confidence-Treffer landen in einem separaten Abschnitt zur manuellen Sichtung.

## Rätsel-Sieger manuell nachpflegen

Direkt in `data/raetsel-overrides.json` für einzelne Folgen:

```json
{
  "12": {
    "winner": "jochen",
    "question": "Was war der Anlass für den Schlüsseldienst-Skandal?",
    "answer": "Überteuerte Notdienst-Pauschalen.",
    "notes": "Punkt im Nachhinein anerkannt."
  },
  "143": {
    "skipped": true,
    "notes": "Live-Folge, kein Rätsel."
  }
}
```

Felder:

- `winner`: `"etienne"`, `"jochen"`, `"georg"` oder `null`.
- `question` / `answer`: Wortlaut (optional).
- `skipped`: `true` wenn die Folge gar kein Rätsel hatte.
- `notes`: Freitext-Begründung.
- `_auto` / `_confidence` / `_model`: vom Extraktor gesetzt – beim manuellen Editieren weglassen.

Nach dem Editieren: `npm run build:data` neu laufen lassen.

## Projektstruktur

```
/transscript/              # original Podcast-Transkripte (unverändert)
/scripts/build-data.mjs    # Parser-Pipeline
/data/
  episodes.json            # voll geparste Daten (ins Worker-Bundle eingebunden)
  episodes-slim.json       # Kurz-Index (für Optimierung)
  stats.json               # aggregierte Statistiken
  raetsel-overrides.json   # manuelle Sieger-Einträge
/src/
  index.js                 # Hono-Worker-Entry
  views/
    layout.js              # HTML-Hülle + html``-Template-Tag mit Escaping
    pages.js               # Renderer pro Seite
/public/
  css/main.css             # einziges Stylesheet
wrangler.toml              # Cloudflare-Worker-Konfig
```

## Chat-Assistent

Der Worker hat eine Chat-KI auf `/chat`, die per `POST /api/chat` **Cloudflare Workers AI** aufruft – kein externer API-Key nötig.

- Modell: `@cf/meta/llama-3.3-70b-instruct-fp8-fast` mit Fallback `@cf/meta/llama-3.1-8b-instruct-fast`.
- Binding in `wrangler.toml`: `[ai]\nbinding = "AI"`.
- System-Prompt enthält Folgen-Index, Host-Bios, Running-Gag-Zusammenfassungen und die aktuelle Punktetabelle.
- Nach jeder dritten Frage hängt der Worker einen kleinen PayPal-Hinweis ans Antwortende.

Workers AI Free Tier: 10.000 Neuronen/Tag (für die paar Wiki-Anfragen locker genug).

## Tech-Stack

- **[Hono](https://hono.dev/)** als minimales Router-Framework für Workers.
- **Cloudflare Workers** mit Static Assets für das CSS.
- **Plain HTML + CSS** server-rendered, kein Client-JS-Framework.
- **JSON-Daten** beim Build aus den Transkripten erzeugt und ins Worker-Bundle eingebunden.

Bundle-Größe: ca. 1.9 MB / 580 KB gzipped — passt in den Workers-Free-Tier.

## Lizenz / Disclaimer

Fan-Projekt, keine Verbindung zum Podcast oder seinen Hosts. Transkripte gehören ihren jeweiligen Rechteinhabern.
