// Server-rendered HTML — approximates onetimesuite.com's "price sticker" identity.
// Design tokens lifted from onetimesuite-com/src/site.css.

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const CSS = `
:root {
  --paper: #f4f5f2; --ink: #17191d; --ink-soft: #4b4e55; --ink-faint: #85888f;
  --accent: #2b4bdd; --price: #e8420c; --line: #d8dad4; --paper-raised: #ffffff;
  --display: "Bricolage Grotesque", system-ui, sans-serif;
  --body: "Instrument Sans", system-ui, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, monospace;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: var(--body); font-size: 1.0625rem; line-height: 1.65; color: var(--ink); background: var(--paper); -webkit-font-smoothing: antialiased; }
h1, h2 { font-family: var(--display); font-weight: 800; line-height: 1.1; letter-spacing: -0.015em; }
h1 { font-size: clamp(2rem, 5vw, 3.2rem); }
a { color: var(--accent); text-decoration-thickness: 1px; text-underline-offset: 3px; }
a:hover { text-decoration-thickness: 2px; }
.wrap { max-width: 1120px; margin: 0 auto; padding: 0 1.5rem; }
.site-nav { border-bottom: 1px solid var(--line); background: var(--paper); position: sticky; top: 0; z-index: 40; }
.site-nav .wrap { display: flex; align-items: center; gap: 1.6rem; height: 62px; }
.wordmark { font-family: var(--display); font-weight: 800; font-size: 1.18rem; color: var(--ink); text-decoration: none; letter-spacing: -0.02em; }
.wordmark .once { color: var(--price); }
.nav-right { margin-left: auto; display: flex; align-items: center; gap: 1rem; font-family: var(--mono); font-size: 0.8rem; }
.stamp { display: inline-block; font-family: var(--mono); font-size: 0.72rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.14em; color: var(--ink-soft); border: 1px solid var(--ink-soft); border-radius: 3px; padding: 0.2rem 0.6rem; margin-bottom: 1.1rem; }
.stamp.orange { color: var(--price); border-color: var(--price); }
section { padding: 3.5rem 0; }
.btn { display: inline-block; font-family: var(--mono); font-size: 0.95rem; font-weight: 600; background: var(--ink); color: #fff; text-decoration: none; padding: 0.85rem 1.6rem; border-radius: 6px; }
.btn:hover { background: #000; }
.btn.orange { background: var(--price); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; margin-top: 2rem; }
.card { background: var(--paper-raised); border: 1px solid var(--line); border-radius: 8px; padding: 1.25rem 1.35rem; display: flex; flex-direction: column; gap: 0.55rem; }
.card h3 { font-family: var(--display); font-size: 1.08rem; font-weight: 700; letter-spacing: -0.01em; }
.card .slug { font-family: var(--mono); font-size: 0.72rem; color: var(--ink-faint); text-transform: uppercase; letter-spacing: 0.1em; }
.card .price-fig { font-family: var(--mono); font-weight: 600; color: var(--price); font-size: 0.9rem; }
.card .links { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; font-family: var(--mono); font-size: 0.8rem; margin-top: auto; padding-top: 0.5rem; border-top: 1px dashed var(--line); }
.muted { color: var(--ink-soft); }
.faint { color: var(--ink-faint); font-family: var(--mono); font-size: 0.8rem; }
.notice { background: var(--paper-raised); border: 1px solid var(--line); border-left: 3px solid var(--price); border-radius: 6px; padding: 1rem 1.25rem; margin: 1.5rem 0; }
footer { border-top: 1px solid var(--line); padding: 2rem 0; margin-top: 3rem; }
`;

function layout({ title, body, user }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;800&family=IBM+Plex+Mono:wght@400;500;600&family=Instrument+Sans:wght@400;600&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
<nav class="site-nav"><div class="wrap">
  <a class="wordmark" href="/">OneTimeSuite<span class="once">.</span>dashboard</a>
  <div class="nav-right">
    <a href="https://onetimesuite.com/">onetimesuite.com</a>
    ${user ? `<span class="muted">@${esc(user.username || user.userId)}</span> <a href="/logout">log out</a>` : ''}
  </div>
</div></nav>
${body}
<footer><div class="wrap faint">OneTimeSuite — buy once, own forever. &copy; ${new Date().getFullYear()}</div></footer>
</body>
</html>`;
}

function loginPage({ error } = {}) {
  const body = `
<section><div class="wrap">
  <span class="stamp orange">Customer dashboard</span>
  <h1>See your OneTimeSuite library.</h1>
  <p class="muted" style="max-width:56ch;margin:1.2rem 0 2rem;">
    Log in with the Whop account you bought with. We'll show every OneTimeSuite
    product you own — with its GitHub repo, product page and app link. Bought
    the Complete bundle? You'll see all 100+.
  </p>
  ${error ? `<div class="notice"><strong>Sign-in problem:</strong> <span class="muted">${esc(error)}</span></div>` : ''}
  <a class="btn orange" href="/login">Login with Whop &rarr;</a>
  <p class="faint" style="margin-top:1.5rem;">We never see your password — Whop handles sign-in (OAuth). We only read which products you own.</p>
</div></section>`;
  return layout({ title: 'OneTimeSuite — Your library', body });
}

function productCard(p) {
  return `<div class="card">
  <span class="slug">${esc(p.slug)}</span>
  <h3>${esc(p.icon ? p.icon + ' ' : '')}${esc(p.brand || p.title)}</h3>
  <span class="price-fig">$${esc(p.price)} once — owned</span>
  <div class="links">
    <a href="https://github.com/bensblueprints/${esc(p.repo)}" target="_blank" rel="noopener">GitHub</a>
    <a href="https://${esc(p.slug)}.onetimesuite.com" target="_blank" rel="noopener">${esc(p.slug)}.onetimesuite.com</a>
    <a href="https://onetimesuite.com/${esc(p.slug)}/" target="_blank" rel="noopener">product page</a>
  </div>
</div>`;
}

function dashboardPage({ user, owned, hasBundle, catalogSize }) {
  const cards = owned.map(productCard).join('\n');
  const body = `
<section><div class="wrap">
  <span class="stamp">Your library</span>
  <h1>${esc(user.name || user.username || 'Welcome back')}.</h1>
  <p class="muted" style="margin-top:0.8rem;">
    ${hasBundle
      ? `You own <strong>OneTimeSuite Complete</strong> — the whole suite. All ${catalogSize} products are yours.`
      : owned.length
        ? `You own ${owned.length} OneTimeSuite product${owned.length === 1 ? '' : 's'}.`
        : `No OneTimeSuite purchases found on this Whop account yet.`}
  </p>
  ${owned.length ? `<div class="grid">${cards}</div>` : `
  <div class="notice">
    Nothing here? Make sure you logged in with the same Whop account you purchased with,
    or browse the suite at <a href="https://onetimesuite.com/">onetimesuite.com</a>.
  </div>`}
</div></section>`;
  return layout({ title: 'OneTimeSuite — Your library', body, user });
}

function errorPage(status, message) {
  const body = `
<section><div class="wrap">
  <span class="stamp orange">${esc(status)}</span>
  <h1>Something went sideways.</h1>
  <p class="muted" style="margin:1rem 0 2rem;">${esc(message)}</p>
  <a class="btn" href="/">&larr; Back to start</a>
</div></section>`;
  return layout({ title: `OneTimeSuite — ${status}`, body });
}

module.exports = { loginPage, dashboardPage, errorPage };
