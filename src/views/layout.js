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
    { href: "/random", label: "Random Folge", id: "random" },
  ];
  const nav = navItems
    .map((it) => `<a class="${currentNav === it.id ? "active" : ""}" href="${it.href}">${escapeHtml(it.label)}</a>`)
    .join("");

  const bodyStr = body instanceof SafeHtml ? body.s : String(body);

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
    <a class="brand" href="/" title="Das Wiki Ohne Richtigen Namen">
      <span class="brand-emoji">🎙️</span>
      <span class="brand-text">das <span class="brand-worn"><span class="acr">W</span><span class="acr">O</span><span class="acr">R</span><span class="acr">N</span></span></span>
      <span class="brand-sub"><strong>W</strong>iki <strong>O</strong>hne <strong>R</strong>ichtigen <strong>N</strong>amen</span>
    </a>
    <nav class="main-nav">${nav}</nav>
  </div>
</header>
<main class="wrap">
${bodyStr}
</main>
<footer class="site-footer">
  <div class="wrap">
    <p><strong>das worn</strong> – Wiki Ohne Richtigen Namen. Ein inoffizielles Fan-Projekt. Keine Verbindung zum Podcast oder seinen Hosts.</p>
    <p class="footer-meta">Läuft auf Cloudflare Workers · <a href="/about">Über dieses Wiki</a></p>
  </div>
</footer>
</body>
</html>`;
}
