// HTML layout & shared building blocks.
// Plain template literals; SafeHtml class lets nested html`` not get escaped.

class SafeHtml {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}

export function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function html(strings, ...values) {
  let out = "";
  for (let i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i < values.length) {
      const v = values[i];
      if (v == null || v === false) continue;
      if (v instanceof SafeHtml) out += v.s;
      else if (Array.isArray(v)) {
        for (const item of v) {
          if (item == null || item === false) continue;
          if (item instanceof SafeHtml) out += item.s;
          else out += escapeHtml(item);
        }
      }
      else if (typeof v === "object" && v.raw != null) out += v.raw;
      else out += escapeHtml(v);
    }
  }
  return new SafeHtml(out);
}

export function raw(s) {
  return new SafeHtml(s);
}

export function layout({ title, body, currentNav = "" }) {
  const navItems = [
    { href: "/", label: "Start", id: "start" },
    { href: "/folgen", label: "Folgen", id: "folgen" },
    { href: "/raetsel", label: "Rätsel & Punkte", id: "raetsel" },
    { href: "/lore", label: "Running Gags", id: "lore" },
    { href: "/hosts", label: "Hosts", id: "hosts" },
    { href: "/statistiken", label: "Statistiken", id: "stats" },
    { href: "/chat", label: "💬 Chat", id: "chat" },
    { href: "/random", label: "Random Folge", id: "random" },
  ];
  const nav = navItems
    .map((it) => `<a class="${currentNav === it.id ? "active" : ""}" href="${it.href}">${escapeHtml(it.label)}</a>`)
    .join("");

  const bodyStr = body instanceof SafeHtml ? body.s : String(body);

  const cookieBanner = `
<div id="cookie-banner" class="cookie-banner" hidden>
  <img src="/cookie.png" alt="Eddi-Cookie" class="cookie-img">
  <div class="cookie-content">
    <p class="cookie-headline">Moin, ich bin Eddi.</p>
    <p>
      Ich bin kein Keks. Ich bin auch kein Cookie im Browser-Sinn –
      <strong>das worn setzt keine Tracking-Cookies</strong>. Nur das was Cloudflare zum Funktionieren braucht.
      Aber jeder kennt diese Banner und Etienne (alias Eddi) macht sich hier zum Cookie. So.
    </p>
    <p class="cookie-mini">
      <em>(Du sahst übrigens nicht ernsthaft versucht, diesen Banner in der Mikrowelle zu schließen, oder?)</em>
    </p>
    <div class="cookie-actions">
      <button id="cookie-ok" class="btn primary">Eddi schmecken lassen</button>
      <button id="cookie-meh" class="btn">Geh weg, Eddi</button>
    </div>
  </div>
</div>
`;

  // Tiny JS for: cookie banner persistence + Konami code + brand-click counter
  const easterEggsJs = `
(() => {
  // ── Cookie banner ──
  try {
    if (!localStorage.getItem('wornCookie')) {
      const b = document.getElementById('cookie-banner');
      if (b) b.hidden = false;
    }
  } catch (e) {}
  const dismiss = (mode) => {
    try { localStorage.setItem('wornCookie', mode); } catch (e) {}
    const b = document.getElementById('cookie-banner');
    if (b) b.hidden = true;
  };
  document.getElementById('cookie-ok')?.addEventListener('click', () => dismiss('eaten'));
  document.getElementById('cookie-meh')?.addEventListener('click', () => dismiss('shooed'));

  // ── Konami code: ↑ ↑ ↓ ↓ ← → ← → B A ──
  const seq = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  let idx = 0;
  document.addEventListener('keydown', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === seq[idx]) {
      idx++;
      if (idx === seq.length) { idx = 0; triggerPommesRain(); }
    } else { idx = (k === seq[0]) ? 1 : 0; }
  });
  function triggerPommesRain() {
    const overlay = document.createElement('div');
    overlay.className = 'pommes-rain';
    for (let i = 0; i < 60; i++) {
      const s = document.createElement('span');
      s.textContent = ['🍟','🍟','🍟','🥔','🎙️'][Math.floor(Math.random()*5)];
      s.style.left = (Math.random()*100) + 'vw';
      s.style.animationDelay = (Math.random()*1.2) + 's';
      s.style.animationDuration = (2.5 + Math.random()*2.5) + 's';
      s.style.fontSize = (1 + Math.random()*2) + 'rem';
      overlay.appendChild(s);
    }
    document.body.appendChild(overlay);
    const banner = document.createElement('div');
    banner.className = 'pommes-banner';
    banner.innerHTML = '🍟 Du hast nicht ernsthaft versucht, Tiefkühlpommes in der Mikrowelle zu machen!';
    document.body.appendChild(banner);
    setTimeout(() => { overlay.remove(); banner.remove(); }, 6000);
  }

  // ── Brand emoji click counter → confetti at 5 ──
  let brandClicks = 0;
  document.getElementById('brand-link')?.addEventListener('click', (e) => {
    brandClicks++;
    if (brandClicks >= 5) {
      e.preventDefault();
      brandClicks = 0;
      triggerPommesRain();
    }
  });
})();
`;

  // Build linktree-style sub-line in footer is constructed in HTML body above.
  const inlineScript = `<script>${easterEggsJs}</script>`;

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} – das worn</title>
<meta name="description" content="das worn: Das Wiki Ohne Richtigen Namen zum Podcast ohne richtigen Namen mit Etienne Garde, Jochen und Georg.">
<link rel="stylesheet" href="/css/main.css">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2280%22>🎙️</text></svg>">
</head>
<body>
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="/" title="Das Wiki Ohne Richtigen Namen" id="brand-link">
      <span class="brand-emoji">🎙️</span>
      <span class="brand-text">das <span class="brand-worn"><span class="acr">W</span><span class="acr">O</span><span class="acr">R</span><span class="acr">N</span></span></span>
      <span class="brand-sub"><strong>W</strong>iki <strong>O</strong>hne <strong>R</strong>ichtigen <strong>N</strong>amen</span>
    </a>
    <nav class="main-nav">${nav}</nav>
    <div class="listen-strip" aria-label="Podcast hören">
      <span class="listen-label">Podcast hören:</span>
      <a class="listen-link spotify" href="https://open.spotify.com/show/337WgqUhBAcKQwlA2MZJtu" rel="noopener" target="_blank">Spotify</a>
      <a class="listen-link apple" href="https://podcasts.apple.com/de/podcast/podcast-ohne-richtigen-namen/id1351207963" rel="noopener" target="_blank">Apple Podcasts</a>
      <a class="listen-link web" href="https://www.podcastohnerichtigennamen.de" rel="noopener" target="_blank">Website</a>
    </div>
  </div>
</header>
<main class="wrap">
${bodyStr}
</main>
<footer class="site-footer">
  <div class="wrap">
    <div class="footer-help">
      🆘 <strong>Hilfe gesucht!</strong> Ich suche bessere Transkripte – mit Sprecher-Namen pro Absatz und Zeitstempeln.
      Wenn du sowas hast oder weißt wo's welche gibt, melde dich gern oder
      <a href="https://github.com/koljasagorski/das-worn.de" rel="noopener">trag was zum GitHub-Projekt bei</a>.
    </div>
    <p><strong>das worn</strong> – Wiki Ohne Richtigen Namen. Ein inoffizielles Fan-Projekt. Keine Verbindung zum Podcast oder seinen Hosts.</p>
    <nav class="footer-social" aria-label="Social Media">
      <a href="https://github.com/koljasagorski/das-worn.de" rel="noopener" title="Code beitragen">🐙 GitHub</a>
      <a href="https://www.linkedin.com/in/koljasagorski/" rel="noopener" title="LinkedIn-Profil von Kolja">💼 LinkedIn</a>
      <a href="https://www.instagram.com/keepcalmanddrinkchampagne/" rel="noopener" title="Instagram-Profil von Kolja">📷 Instagram</a>
      <a href="https://paypal.me/gigalogi" rel="noopener" title="Wenn dir das Wiki gefällt – paypal@koljasagorski.de">☕ Spende</a>
    </nav>
    <p class="footer-meta">Läuft auf Cloudflare Workers · <a href="/about">Über dieses Wiki</a></p>
  </div>
</footer>
${cookieBanner}
${inlineScript}
</body>
</html>`;
}
