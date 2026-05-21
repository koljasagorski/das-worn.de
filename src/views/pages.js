import { layout, html, raw, escapeHtml } from "./layout.js";

const HOST_INFO = {
  etienne: {
    name: "Etienne Garde",
    aliases: ["Eddi", "Eddie"],
    blurb: 'Schauspieler, Moderator, Synchronsprecher und bekannt von Rocket Beans TV. Im Podcast oft als „Eddi" angesprochen und gerne mal das Ziel kleiner Sticheleien.',
    fun: "Hat eine türkische Wurzel, war angeblich Schützenkönig und ist laut Folge 159 ein 'Erotik-Sprecher'.",
    color: "#e85a4f",
  },
  jochen: {
    name: "Jochen",
    aliases: [],
    blurb: "Der Mann mit der USB-Maus, die manchmal spinnt. Hat ein gespanntes Verhältnis zur Polizei-Hotline und ein Faible für ausführliche Anekdoten.",
    fun: "Ruft öfter mal die 110 wegen Kleinigkeiten und hat einmal eine Marihuana-Plantage über sich wohnen gehabt (London).",
    color: "#3a86ff",
  },
  georg: {
    name: "Georg",
    aliases: [],
    blurb: "Der Rätselmeister. Stellt am Ende fast jeder Folge das Rätsel und sitzt strategisch über den Punkten.",
    fun: "Hat mindestens einen Fall, in dem er aus einer Karneval-Tagesinfo eine Detektivgeschichte macht.",
    color: "#2a9d8f",
  },
};

// ─────────────────────────────────────────────────────────────
// Start page
// ─────────────────────────────────────────────────────────────
export function renderHome({ stats, episodes }) {
  const recent = [...episodes].sort((a, b) => b.number - a.number).slice(0, 6);
  const recentCards = recent
    .map(
      (e) => html`
        <a class="card episode-card" href="/folge/${e.number}">
          <div class="card-num">Folge ${e.number}</div>
          <div class="card-title">${e.title}</div>
          <div class="card-meta">${e.wordCount.toLocaleString("de-DE")} Wörter</div>
        </a>
      `,
    )
    .join("");

  const winnersTotal = stats.winners.etienne + stats.winners.jochen + stats.winners.georg;
  const body = html`
    <section class="hero">
      <h1>das worn</h1>
      <p class="hero-tagline"><strong>W</strong>iki <strong>O</strong>hne <strong>R</strong>ichtigen <strong>N</strong>amen – zum Podcast ohne richtigen Namen.</p>
      <p class="hero-sub">
        Über <strong>${stats.episodeCount}</strong> Folgen mit <strong>Etienne</strong>, <strong>Jochen</strong> und <strong>Georg</strong>.
        Geschätzte Hörzeit: <strong>${stats.estimatedHours} Stunden</strong>.
        ${stats.totalWords.toLocaleString("de-DE")} Wörter Quatsch.
      </p>
      <div class="hero-buttons">
        <a class="btn primary" href="/folgen">Alle Folgen</a>
        <a class="btn" href="/raetsel">Rätsel & Punkte</a>
        <a class="btn" href="/random">🎲 Random Folge</a>
      </div>
    </section>

    <section class="stat-grid">
      <div class="stat-box">
        <div class="stat-num">${stats.episodeCount}</div>
        <div class="stat-label">Folgen erfasst</div>
      </div>
      <div class="stat-box">
        <div class="stat-num">${stats.estimatedHours}h</div>
        <div class="stat-label">Hörzeit (geschätzt)</div>
      </div>
      <div class="stat-box">
        <div class="stat-num">${(stats.totalWords / 1e6).toFixed(2)}M</div>
        <div class="stat-label">Wörter</div>
      </div>
      <div class="stat-box">
        <div class="stat-num">${winnersTotal}</div>
        <div class="stat-label">Vergebene Rätsel-Punkte</div>
      </div>
    </section>

    <section>
      <h2>Neueste Folgen</h2>
      <div class="card-grid">${raw(recentCards)}</div>
      <p><a class="link-arrow" href="/folgen">Alle ${stats.episodeCount} Folgen ansehen →</a></p>
    </section>

    <section class="dual">
      <div>
        <h2>Hosts</h2>
        <div class="host-strip">
          ${raw(
            Object.entries(HOST_INFO)
              .map(
                ([key, h]) => html`
                  <a class="host-chip" style="--c:${h.color}" href="/hosts#${key}">
                    <span class="host-name">${h.name}</span>
                    <span class="host-meta">${stats.totalMentions[key].toLocaleString("de-DE")} Erwähnungen</span>
                  </a>
                `,
              )
              .join(""),
          )}
        </div>
      </div>
      <div>
        <h2>Schnell-Stats</h2>
        <ul class="quick-stats">
          <li><strong>Längste Folge:</strong> <a href="/folge/${stats.longest[0].number}">#${stats.longest[0].number} ${escapeHtml(stats.longest[0].title)}</a> (${stats.longest[0].wordCount.toLocaleString("de-DE")} Wörter)</li>
          <li><strong>Kürzeste Folge:</strong> <a href="/folge/${stats.shortest[0].number}">#${stats.shortest[0].number} ${escapeHtml(stats.shortest[0].title)}</a></li>
          <li><strong>Pommes-Erwähnungen total:</strong> ${stats.totalFun.pommes}× 🍟</li>
          <li><strong>"Quatsch" gesagt:</strong> ${stats.totalFun.quatsch}×</li>
          <li><strong>"Tschüss" gesagt:</strong> ${stats.totalFun.tschuess}×</li>
        </ul>
      </div>
    </section>
  `;

  return layout({ title: "Start", body, currentNav: "start" });
}

// ─────────────────────────────────────────────────────────────
// Episodes list (with search)
// ─────────────────────────────────────────────────────────────
export function renderEpisodesList({ episodes, query }) {
  const q = (query || "").trim().toLowerCase();
  const filtered = q
    ? episodes.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          String(e.number).includes(q) ||
          (e.teaser || "").toLowerCase().includes(q),
      )
    : episodes;

  const list = [...filtered]
    .sort((a, b) => b.number - a.number)
    .map(
      (e) => html`
        <a class="ep-row" href="/folge/${e.number}">
          <span class="ep-num">#${e.number}</span>
          <span class="ep-title">${e.title}</span>
          <span class="ep-meta">${(e.wordCount / 1000).toFixed(1)}k W.</span>
        </a>
      `,
    )
    .join("");

  const body = html`
    <h1>Alle Folgen</h1>
    <p>${filtered.length} von ${episodes.length} Folgen.</p>
    <form class="search-form" method="get" action="/folgen">
      <input type="search" name="q" placeholder="Folgentitel oder -nummer..." value="${q}" autofocus>
      <button type="submit">Suchen</button>
      ${q ? html`<a class="btn-ghost" href="/folgen">×</a>` : ""}
    </form>
    <div class="ep-list">${raw(list || "<p>Keine Folgen gefunden.</p>")}</div>
  `;

  return layout({ title: "Alle Folgen", body, currentNav: "folgen" });
}

// ─────────────────────────────────────────────────────────────
// Episode detail
// ─────────────────────────────────────────────────────────────
export function renderEpisode({ episode, prev, next }) {
  const r = episode.raetsel;

  const winnerLabel = r.winner || r.heuristicWinner;
  const winnerBadge = winnerLabel
    ? html`<span class="winner-badge winner-${winnerLabel}">🏆 ${HOST_INFO[winnerLabel]?.name || winnerLabel}</span>`
    : r.skipped
    ? html`<span class="badge muted">Kein Rätsel in dieser Folge</span>`
    : html`<span class="badge muted">Sieger noch nicht erfasst</span>`;

  const mentions = episode.hostMentions;
  const totalM = mentions.etienne + mentions.jochen + mentions.georg || 1;

  const navPrev = prev ? html`<a class="prev-next" href="/folge/${prev.number}">← #${prev.number} ${prev.title}</a>` : "";
  const navNext = next ? html`<a class="prev-next next" href="/folge/${next.number}">#${next.number} ${next.title} →</a>` : "";

  const topWordsHtml = (episode.topWords || [])
    .slice(0, 12)
    .map((w) => html`<span class="chip">${w.word} <em>${w.count}</em></span>`)
    .join("");

  const body = html`
    <article class="episode">
      <div class="episode-nav">${raw(navPrev)} ${raw(navNext)}</div>

      <header class="ep-header">
        <div class="ep-number-big">#${episode.number}</div>
        <h1>${episode.title}</h1>
        <div class="ep-stats-row">
          <span class="badge">${episode.wordCount.toLocaleString("de-DE")} Wörter</span>
          <span class="badge">${Math.round(episode.wordCount / 130)} Min. (geschätzt)</span>
          ${raw(winnerBadge)}
        </div>
      </header>

      ${episode.teaser ? html`<p class="teaser">${episode.teaser}…</p>` : ""}

      <section class="card-section">
        <h2>🧩 Rätsel</h2>
        ${
          r.question || r.answer
            ? html`
              <div class="raetsel-card">
                ${r.autoExtracted ? html`<div class="auto-banner">
                  🤖 Automatisch extrahiert mit ${r.model || "LLM"}
                  ${r.confidence ? html`<span class="conf conf-${r.confidence}">Confidence: ${r.confidence}</span>` : ""}
                </div>` : ""}
                ${r.question ? html`<h3>Frage</h3><p>${r.question}</p>` : ""}
                ${r.answer ? html`<h3>Antwort</h3><p>${r.answer}</p>` : ""}
                ${r.winner ? html`<p><strong>Punkt für:</strong> ${HOST_INFO[r.winner]?.name || r.winner}</p>` : html`<p class="muted">Sieger nicht eindeutig zugeordnet.</p>`}
                ${r.notes ? html`<p class="note">${r.notes}</p>` : ""}
              </div>
            `
            : r.skipped
            ? html`<p class="muted">In dieser Folge wurde kein Rätsel gestellt.</p>`
            : html`
              <details class="raetsel-auto">
                <summary>Automatisch extrahierter Rätsel-Abschnitt ${r.autoDetected ? "" : "(unscharf – Heuristik unsicher)"}</summary>
                <div class="raetsel-excerpt">${r.excerpt}</div>
                ${r.heuristicWinner
                  ? html`<p class="hint">Heuristik vermutet Sieger: <strong>${HOST_INFO[r.heuristicWinner]?.name || r.heuristicWinner}</strong></p>`
                  : html`<p class="hint">Heuristik konnte keinen Sieger erkennen. Lass das Extraktions-Skript laufen oder trag den Sieger in <code>data/raetsel-overrides.json</code> nach.</p>`}
              </details>
            `
        }
      </section>

      <section class="card-section grid-2">
        <div>
          <h2>Wer wird wie oft erwähnt?</h2>
          <div class="bar-chart">
            ${raw(
              Object.entries(mentions)
                .map(
                  ([k, v]) => html`
                    <div class="bar-row">
                      <span class="bar-label">${HOST_INFO[k].name}</span>
                      <span class="bar-track">
                        <span class="bar-fill" style="width:${((v / totalM) * 100).toFixed(1)}%;background:${HOST_INFO[k].color}"></span>
                      </span>
                      <span class="bar-val">${v}</span>
                    </div>
                  `,
                )
                .join(""),
            )}
          </div>
        </div>
        <div>
          <h2>Top-Wörter in dieser Folge</h2>
          <div class="chips">${raw(topWordsHtml)}</div>
        </div>
      </section>

      <section class="card-section">
        <h2>Lustige Zähler</h2>
        <ul class="counters">
          ${raw(
            Object.entries(episode.funCounts)
              .filter(([, v]) => v > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => html`<li><strong>${v}×</strong> ${k}</li>`)
              .join(""),
          )}
        </ul>
      </section>

      <div class="episode-nav">${raw(navPrev)} ${raw(navNext)}</div>
    </article>
  `;
  return layout({ title: `#${episode.number} ${episode.title}`, body, currentNav: "folgen" });
}

// ─────────────────────────────────────────────────────────────
// Hosts page
// ─────────────────────────────────────────────────────────────
export function renderHosts({ stats }) {
  const cards = Object.entries(HOST_INFO)
    .map(([key, h]) => {
      const wins = stats.winners[key];
      const mentions = stats.totalMentions[key];
      const aliases = h.aliases.length ? html`<p class="aliases">Auch genannt: ${h.aliases.join(", ")}</p>` : "";
      return html`
        <section class="host-card" id="${key}" style="--c:${h.color}">
          <div class="host-card-header">
            <h2>${h.name}</h2>
            ${raw(aliases)}
          </div>
          <p>${h.blurb}</p>
          <p class="fun-fact">💡 ${h.fun}</p>
          <div class="host-stats">
            <div><span class="big">${wins}</span><span class="lbl">Rätsel-Punkte</span></div>
            <div><span class="big">${mentions.toLocaleString("de-DE")}</span><span class="lbl">Erwähnungen</span></div>
          </div>
        </section>
      `;
    })
    .join("");

  const body = html`
    <h1>Die Hosts</h1>
    <p>Drei Männer, ein Mikrofon-Setup, kein Name für den Podcast.</p>
    <div class="host-grid">${raw(cards)}</div>
  `;
  return layout({ title: "Hosts", body, currentNav: "hosts" });
}

// ─────────────────────────────────────────────────────────────
// Rätsel & Punkte leaderboard
// ─────────────────────────────────────────────────────────────
export function renderRaetsel({ episodes, stats }) {
  const total = stats.winners.etienne + stats.winners.jochen + stats.winners.georg;
  const order = ["etienne", "jochen", "georg"].sort((a, b) => stats.winners[b] - stats.winners[a]);

  const ranked = order
    .map((k, i) => {
      const pct = total > 0 ? ((stats.winners[k] / total) * 100).toFixed(1) : "0.0";
      return html`
        <div class="rank-row rank-${i + 1}">
          <span class="rank-place">#${i + 1}</span>
          <span class="rank-name" style="color:${HOST_INFO[k].color}">${HOST_INFO[k].name}</span>
          <span class="rank-bar">
            <span class="rank-fill" style="width:${pct}%;background:${HOST_INFO[k].color}"></span>
          </span>
          <span class="rank-pts"><strong>${stats.winners[k]}</strong> Punkte</span>
        </div>
      `;
    })
    .join("");

  // Categorize episodes
  const withWinners = episodes
    .filter((e) => {
      if (e.raetsel.skipped) return false;
      const w = e.raetsel.winner || e.raetsel.heuristicWinner;
      if (!w) return false;
      const isAuto = e.raetsel.autoExtracted;
      const conf = e.raetsel.confidence;
      return !isAuto || conf === "high" || conf === "medium";
    })
    .sort((a, b) => b.number - a.number);

  const lowConfWinners = episodes
    .filter((e) => !e.raetsel.skipped && e.raetsel.winner && e.raetsel.autoExtracted && e.raetsel.confidence === "low")
    .sort((a, b) => b.number - a.number);

  const skippedEpisodes = episodes.filter((e) => e.raetsel.skipped).sort((a, b) => b.number - a.number);
  const unclearEpisodes = episodes.filter((e) => !e.raetsel.skipped && !e.raetsel.winner && !e.raetsel.heuristicWinner).sort((a, b) => b.number - a.number);

  const renderEpisodeRow = (e, withConf = false) => {
    const w = e.raetsel.winner || e.raetsel.heuristicWinner;
    const confBadge = withConf && e.raetsel.confidence
      ? html`<span class="conf conf-${e.raetsel.confidence}">${e.raetsel.confidence}</span>`
      : "";
    return html`
      <a class="ep-row" href="/folge/${e.number}">
        <span class="ep-num">#${e.number}</span>
        <span class="ep-title">${e.title}</span>
        ${confBadge}
        ${w ? html`<span class="winner-tag" style="background:${HOST_INFO[w].color}">${HOST_INFO[w].name}</span>` : ""}
      </a>
    `;
  };

  const body = html`
    <h1>🧩 Rätsel & Punkte</h1>
    <p>
      Fast jede Folge endet (oder hat irgendwo) ein Rätsel. Wer es löst, bekommt den Punkt.
      Halbe und Viertelpunkte fließen vereinfacht als ganzer Punkt zum jeweiligen Sieger ein.
    </p>

    <section>
      <h2>Aktuelle Punktetabelle</h2>
      <div class="leaderboard">${raw(ranked)}</div>
      <p class="muted small">
        <strong>${total}</strong> bestätigte Sieger · <strong>${lowConfWinners.length}</strong> mit niedriger Confidence (nicht gewertet) ·
        <strong>${unclearEpisodes.length}</strong> unklar · <strong>${skippedEpisodes.length}</strong> Folgen ohne Rätsel.
      </p>
    </section>

    <section>
      <h2>Folgen mit Siegern (${withWinners.length})</h2>
      ${withWinners.length
        ? html`<div class="ep-list">${withWinners.map((e) => renderEpisodeRow(e, true))}</div>`
        : html`<p class="muted">Noch keine Folgen mit erkannten Siegern.</p>`}
    </section>

    ${lowConfWinners.length ? html`
      <section>
        <h2>Niedrige Confidence (${lowConfWinners.length})</h2>
        <p class="muted small">Diese Sieger sind unsicher (halbe Punkte, Mehrdeutigkeit, …) und gehen nicht in die Tabelle ein.</p>
        <div class="ep-list">${lowConfWinners.map((e) => renderEpisodeRow(e, true))}</div>
      </section>
    ` : ""}

    ${unclearEpisodes.length ? html`
      <section>
        <h2>Unklare Folgen (${unclearEpisodes.length})</h2>
        <p class="muted small">Hier wurde ein Rätsel erkannt, aber kein eindeutiger Sieger. Manuell in <code>data/raetsel-overrides.json</code> nachtragen.</p>
        <details>
          <summary>Liste anzeigen</summary>
          <div class="ep-list">${unclearEpisodes.slice(0, 60).map((e) => renderEpisodeRow(e, false))}</div>
        </details>
      </section>
    ` : ""}

    ${skippedEpisodes.length ? html`
      <section>
        <h2>Folgen ohne Rätsel (${skippedEpisodes.length})</h2>
        <details>
          <summary>Liste anzeigen</summary>
          <div class="ep-list">${skippedEpisodes.slice(0, 60).map((e) => renderEpisodeRow(e, false))}</div>
        </details>
      </section>
    ` : ""}
  `;
  return layout({ title: "Rätsel & Punkte", body, currentNav: "raetsel" });
}

// ─────────────────────────────────────────────────────────────
// Statistics page (fun stats)
// ─────────────────────────────────────────────────────────────
export function renderStats({ stats }) {
  const wordRows = stats.topGlobal
    .slice(0, 25)
    .map(
      (w, i) => html`
        <li>
          <span class="word-rank">${i + 1}.</span>
          <span class="word-word">${w.word}</span>
          <span class="word-count">${w.count.toLocaleString("de-DE")}×</span>
        </li>
      `,
    )
    .join("");

  const longestRows = stats.longest
    .map(
      (e) => html`
        <a class="ep-row" href="/folge/${e.number}">
          <span class="ep-num">#${e.number}</span>
          <span class="ep-title">${e.title}</span>
          <span class="ep-meta">${e.wordCount.toLocaleString("de-DE")} Wörter</span>
        </a>
      `,
    )
    .join("");

  const shortestRows = stats.shortest
    .map(
      (e) => html`
        <a class="ep-row" href="/folge/${e.number}">
          <span class="ep-num">#${e.number}</span>
          <span class="ep-title">${e.title}</span>
          <span class="ep-meta">${e.wordCount.toLocaleString("de-DE")} Wörter</span>
        </a>
      `,
    )
    .join("");

  const laughRows = stats.mostLaughs
    .map(
      (e) => html`
        <a class="ep-row" href="/folge/${e.number}">
          <span class="ep-num">#${e.number}</span>
          <span class="ep-title">${e.title}</span>
          <span class="ep-meta">${e.count}× haha</span>
        </a>
      `,
    )
    .join("");

  const quatschRows = stats.mostQuatsch
    .map(
      (e) => html`
        <a class="ep-row" href="/folge/${e.number}">
          <span class="ep-num">#${e.number}</span>
          <span class="ep-title">${e.title}</span>
          <span class="ep-meta">${e.count}× Quatsch</span>
        </a>
      `,
    )
    .join("");

  // Fun-Counts grid
  const funLabels = {
    haha: "Lacher (haha/hehe)",
    quatsch: "Quatsch",
    cool: "Cool",
    geil: "Geil",
    krass: "Krass",
    digga: "Digga",
    alter: "Alter/Alta",
    scheisse: "Scheiße",
    leute: 'Leute',
    tschuess: "Tschüss/Bye",
    podcast: "Podcast",
    pommes: "Pommes 🍟",
    nettetal: "Nettetal",
    lobberich: "Lobberich (FC)",
    nordfriese: "Nordfriese",
  };
  const funGrid = Object.entries(stats.totalFun)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([k, v]) => html`
        <div class="fun-tile">
          <div class="fun-count">${v.toLocaleString("de-DE")}</div>
          <div class="fun-label">${funLabels[k] || k}</div>
        </div>
      `,
    )
    .join("");

  const body = html`
    <h1>📊 Statistiken</h1>
    <p>Zahlen über das, was im Podcast so gesagt wird.</p>

    <section class="stat-grid">
      <div class="stat-box">
        <div class="stat-num">${stats.episodeCount}</div>
        <div class="stat-label">Folgen</div>
      </div>
      <div class="stat-box">
        <div class="stat-num">${stats.totalWords.toLocaleString("de-DE")}</div>
        <div class="stat-label">Wörter gesamt</div>
      </div>
      <div class="stat-box">
        <div class="stat-num">${stats.avgWords.toLocaleString("de-DE")}</div>
        <div class="stat-label">Ø Wörter pro Folge</div>
      </div>
      <div class="stat-box">
        <div class="stat-num">${stats.estimatedHours}h</div>
        <div class="stat-label">Hörzeit (geschätzt)</div>
      </div>
    </section>

    <section class="grid-2">
      <div>
        <h2>Längste Folgen</h2>
        <div class="ep-list">${raw(longestRows)}</div>
      </div>
      <div>
        <h2>Kürzeste Folgen</h2>
        <div class="ep-list">${raw(shortestRows)}</div>
      </div>
    </section>

    <section class="grid-2">
      <div>
        <h2>Wo am meisten gelacht wird</h2>
        <div class="ep-list">${raw(laughRows)}</div>
      </div>
      <div>
        <h2>Top "Quatsch"-Folgen</h2>
        <div class="ep-list">${raw(quatschRows)}</div>
      </div>
    </section>

    <section>
      <h2>Top 25 Wörter im gesamten Podcast</h2>
      <ol class="word-list">${raw(wordRows)}</ol>
    </section>

    <section>
      <h2>Lustige Zählerei</h2>
      <p class="muted">Wie oft taucht im gesamten Podcast was auf?</p>
      <div class="fun-grid">${raw(funGrid)}</div>
    </section>

    <section>
      <h2>Erwähnungen je Host</h2>
      <div class="bar-chart big">
        ${raw(
          Object.entries(stats.totalMentions)
            .map(
              ([k, v]) => html`
                <div class="bar-row">
                  <span class="bar-label">${HOST_INFO[k].name}</span>
                  <span class="bar-track">
                    <span class="bar-fill" style="width:${(
                      (v /
                        Math.max(
                          stats.totalMentions.etienne,
                          stats.totalMentions.jochen,
                          stats.totalMentions.georg,
                        )) *
                      100
                    ).toFixed(1)}%;background:${HOST_INFO[k].color}"></span>
                  </span>
                  <span class="bar-val">${v.toLocaleString("de-DE")}</span>
                </div>
              `,
            )
            .join(""),
        )}
      </div>
    </section>
  `;
  return layout({ title: "Statistiken", body, currentNav: "stats" });
}

// ─────────────────────────────────────────────────────────────
// About page
// ─────────────────────────────────────────────────────────────
export function renderAbout({ stats }) {
  const body = html`
    <h1>Über dieses Wiki</h1>
    <p>
      <strong>das worn</strong> steht für <strong>W</strong>iki <strong>O</strong>hne
      <strong>R</strong>ichtigen <strong>N</strong>amen – eine kleine Hommage an den
      <em>Podcast ohne richtigen Namen</em> mit Etienne Garde, Jochen und Georg.
      Die Inhalte basieren auf den Transkripten der Folgen, die hier maschinell
      ausgewertet wurden.
    </p>

    <h2>Wie wurden die Daten erzeugt?</h2>
    <p>
      Ein Node.js-Skript (<code>scripts/build-data.mjs</code>) liest alle
      ${stats.episodeCount} Transkripte ein und extrahiert:
    </p>
    <ul>
      <li>Folgennummer und -titel aus dem Dateinamen.</li>
      <li>Wort- und Zeichenzahlen, Hörzeit-Schätzung (130 Wörter/Min.).</li>
      <li>Erwähnungen der Hosts (Etienne/Eddi, Jochen, Georg).</li>
      <li>Top-Wörter pro Folge sowie aggregiert.</li>
      <li>Lustige Zähler: "Pommes", "Quatsch", "Tschüss", "Lobberich" etc.</li>
      <li>Den letzten Abschnitt der Folge mit Schlüsselwort-Suche nach "Rätsel"/"Frage" als Rätsel-Kandidaten.</li>
      <li>Sieger-Heuristik (sucht z. B. "Punkt für [Name]" oder "[Name] gewinnt").</li>
    </ul>

    <h2>Warum sind nicht alle Rätsel-Sieger erfasst?</h2>
    <p>
      Die Hosts sprechen frei. Statt "Punkt für Etienne" sagen sie eher:
      "Wir werden den im Nachhinein anerkennen, wenn du es wirklich gelöst hast."
      Solche Formulierungen kann eine simple Heuristik nicht zuverlässig auswerten.
      Deshalb gibt es <code>data/raetsel-overrides.json</code>:
    </p>
    <pre><code>{
  "10": {
    "winner": "jochen",
    "question": "Wofür dient ein Baseballfeld auf einer US-Militärbasis?",
    "answer": "Identifikation kubanischer Basen anhand selbstgebauter Baseballfelder.",
    "notes": "Punkt im Nachhinein anerkannt."
  }
}</code></pre>
    <p>
      Sobald Folge X dort eingetragen wird, taucht der Punkt automatisch in der
      Punktetabelle auf.
    </p>

    <h2>Tech-Stack</h2>
    <ul>
      <li><strong>Cloudflare Workers</strong> mit <a href="https://hono.dev">Hono</a> als Mini-Framework.</li>
      <li><strong>Statische Daten</strong>: JSON, gebaut aus Transkripten.</li>
      <li><strong>Frontend</strong>: server-rendered HTML, plain CSS, kein JS-Framework.</li>
    </ul>
  `;
  return layout({ title: "Über dieses Wiki", body, currentNav: "" });
}

export function renderNotFound() {
  const body = html`
    <section class="hero">
      <h1>404 – Folge nicht gefunden</h1>
      <p>Diese Seite gibt es nicht. Vielleicht hat Jochen sie geklaut.</p>
      <div class="hero-buttons">
        <a class="btn primary" href="/">Zur Startseite</a>
        <a class="btn" href="/folgen">Alle Folgen</a>
        <a class="btn" href="/random">🎲 Random Folge</a>
      </div>
    </section>
  `;
  return layout({ title: "404", body, currentNav: "" });
}
