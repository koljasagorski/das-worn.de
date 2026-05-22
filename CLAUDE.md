# Hinweise für Claude Code

Dieses Repo enthält das Fan-Wiki **das worn** für den *Podcast ohne richtigen Namen*. Wenn du Änderungen machst, halte dich an die folgenden Hausregeln.

## Hausregel #1: SEO & Sitemap immer mitziehen

**Jede neue oder geänderte Seite muss SEO + Sitemap aktuell halten.**

- Jeder Page-Renderer in `src/views/pages.js` ruft `layout({ ... })` mit:
  - `title` (Seitentitel ohne Site-Name-Suffix)
  - `description` (page-spezifisch, 50–160 Zeichen, kein Default)
  - `path` (URL-Pfad für canonical + og:url)
  - optional `ogType` (default `website`, für Episoden/Gags `article`)
  - optional `ogImage` (default `/og-default.svg`)
- Wenn du eine **neue Route** in `src/index.js` hinzufügst, die Inhalt hat (also kein API-Endpoint), trag sie auch in den Sitemap-Generator (`app.get("/sitemap.xml")` im selben File) ein. Folgen, Lore-Detail und Business-Ideen werden automatisch aus den Daten erzeugt – statische Routen müssen manuell in das `urls`-Array.
- `public/robots.txt` zeigt auf `https://das-worn.de/sitemap.xml`. Wenn die Domain wechselt, beide Stellen aktualisieren (auch `SITE_URL` in `layout.js` und `src/index.js`).
- Das Default-OG-Bild ist `public/og-default.svg`. Für Sonderseiten (z. B. Folgen-Detail) kann ein eigenes Bild per `ogImage` mitgegeben werden.

## Hausregel #2: Daten immer aus dem Build erzeugen

- Transkripte landen in `transscript/` (so heißt der Ordner aus historischen Gründen).
- `npm run build:data` parst sie zu `data/episodes.json`, `data/stats.json`, `data/gags-resolved.json`.
- Wenn du Episoden hinzufügst, `build:data` einmal laufen lassen und die JSONs mitcommitten – der Worker bundlet sie zur Build-Zeit.

## Hausregel #3: Rätsel-Sieger via Override

- `data/raetsel-overrides.json` ist die Quelle der Wahrheit für Rätsel-Sieger.
- `scripts/extract-raetsel.mjs` füllt das via Claude Haiku auf Wunsch automatisch (nur Folgen mit `confidence: high|medium` zählen für die Punktetabelle).
- Manuelle Einträge ohne `_auto: true` haben Vorrang.

## Hausregel #4: Workers AI ist die Chat-Engine

- Der Chat-Backend in `src/api/chat.js` nutzt `env.AI` (Cloudflare Workers AI). Kein externer API-Key.
- Modell: `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, Fallback `@cf/meta/llama-3.1-8b-instruct-fast`.
- Easter-Egg-Hints und Spenden-Callout werden im Frontend gerendert – nicht serverseitig an die Antwort hängen.

## Hausregel #5: Easter Eggs nicht stillschweigend kaputt machen

Aktive Easter Eggs:
- Konami Code (↑↑↓↓←→←→ba) → Pommes-Regen
- Brand-Emoji 5× Klick → Pommes-Regen
- `/pommes`, `/eddi`, `/onkel-barlow`, `/noriega`, `/kreidefrau`, `/stradivari`
- Cookie-Banner mit Etienne-Foto

Wenn du Routen umstrukturierst, prüf dass die Shortcuts noch funktionieren.

## Projekt-Struktur

```
src/index.js              # Hono routes
src/api/chat.js           # Workers AI chat handler
src/views/layout.js       # Layout, SEO meta, html`` template tag
src/views/pages.js        # Page renderer per Route
public/css/main.css       # einziges Stylesheet
public/cookie.png         # Eddi-Foto fürs Cookie-Banner
public/og-default.svg     # Default-OG-Bild
public/robots.txt         # Sitemap-Hinweis
data/*.json               # Build-Output, im Worker-Bundle
scripts/build-data.mjs    # parst transscript/ → data/
scripts/extract-raetsel.mjs        # AI-Sieger-Extraktion
scripts/extract-business-ideas.mjs # AI-Business-Idee-Extraktion
```
