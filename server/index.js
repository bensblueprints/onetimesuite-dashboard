// OneTimeSuite customer dashboard — plain Node + Express, no build step.
const path = require('path');
const express = require('express');
const whop = require('./whop');
const session = require('./session');
const { loginPage, dashboardPage, errorPage } = require('./render');

const PORT = Number(process.env.PORT) || 5375;
const CLIENT_ID = process.env.WHOP_OAUTH_CLIENT_ID || '';
const CLIENT_SECRET = process.env.WHOP_OAUTH_CLIENT_SECRET || '';
const API_KEY = process.env.WHOP_API_KEY || '';
const REDIRECT_URI = process.env.REDIRECT_URI || `http://localhost:${PORT}/callback`;

if (!process.env.SESSION_SECRET) {
  console.error('FATAL: SESSION_SECRET env var is required.');
  process.exit(1);
}
if (!CLIENT_ID) {
  console.warn('WARN: WHOP_OAUTH_CLIENT_ID not set — /login will not work until configured.');
}

// ---- catalog (baked at build time by scripts/build-catalog.js) ----
const catalog = require(path.join(__dirname, '..', 'catalog.json'));
const BUNDLE_PRODUCT_ID = (catalog.bundle && catalog.bundle.productId) || 'prod_deLvZPOasRITY';
const byProductId = new Map(catalog.products.map((p) => [p.productId, p]));
const OWNED_STATUSES = new Set(['active', 'trialing', 'completed']);

function resolveOwned(memberships) {
  const valid = memberships.filter((m) => OWNED_STATUSES.has(m.status));
  const hasBundle = valid.some((m) => m.productId === BUNDLE_PRODUCT_ID);
  if (hasBundle) return { hasBundle: true, owned: catalog.products };
  const seen = new Set();
  const owned = [];
  for (const m of valid) {
    const p = byProductId.get(m.productId);
    if (p && !seen.has(p.slug)) {
      seen.add(p.slug);
      owned.push(p);
    }
  }
  owned.sort((a, b) => a.slug.localeCompare(b.slug));
  return { hasBundle: false, owned };
}

const app = express();
app.disable('x-powered-by');

// ---- routes ----
app.get('/', (req, res) => {
  const sess = session.getSession(req);
  if (!sess) return res.send(loginPage({ error: req.query.error }));
  const { owned, hasBundle } = resolveOwned(sess.memberships || []);
  res.send(dashboardPage({ user: sess, owned, hasBundle, catalogSize: catalog.products.length }));
});

app.get('/login', (req, res) => {
  if (!CLIENT_ID) return res.status(500).send(errorPage(500, 'OAuth is not configured on this server (missing WHOP_OAUTH_CLIENT_ID).'));
  const state = whop.createState();
  const nonce = whop.createState();
  const pkce = whop.createPkce();
  session.setOauthState(res, { state, verifier: pkce.verifier, nonce });
  res.redirect(whop.buildAuthorizeUrl({
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
    state,
    nonce,
    codeChallenge: pkce.challenge,
  }));
});

app.get('/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;
  if (error) {
    return res.status(400).send(errorPage(400, `Whop returned an error: ${error_description || error}`));
  }
  if (!code) {
    return res.status(400).send(errorPage(400, 'Missing authorization code. Start again from the login page.'));
  }
  const oauthState = session.getOauthState(req);
  if (!oauthState || !state || state !== oauthState.state) {
    return res.status(400).send(errorPage(400, 'State mismatch (possible expired login attempt). Please try logging in again.'));
  }

  try {
    const tokens = await whop.exchangeCode({
      code: String(code),
      redirectUri: REDIRECT_URI,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      codeVerifier: oauthState.verifier,
    });

    const userInfo = await whop.getUserInfo(tokens.access_token);
    const memberships = await whop.listUserMemberships({
      accessToken: tokens.access_token,
      userId: userInfo.sub,
      apiKey: API_KEY,
      companyId: catalog.companyId,
    });

    // Only persist what the dashboard needs — keep the cookie small.
    const relevant = memberships
      .filter((m) => m.productId === BUNDLE_PRODUCT_ID || byProductId.has(m.productId))
      .map((m) => ({ productId: m.productId, status: m.status }));

    session.clearOauthState(res);
    session.setSession(res, {
      userId: userInfo.sub,
      username: userInfo.preferred_username || null,
      name: userInfo.name || null,
      memberships: relevant,
    });
    res.redirect('/');
  } catch (err) {
    console.error('OAuth callback failed:', err.message);
    session.clearOauthState(res);
    res.redirect('/?error=' + encodeURIComponent('Login failed — please try again.'));
  }
});

app.get('/logout', (req, res) => {
  session.clearSession(res);
  res.redirect('/');
});

app.get('/healthz', (req, res) => {
  res.json({ ok: true, products: catalog.products.length });
});

app.use((req, res) => {
  res.status(404).send(errorPage(404, 'That page does not exist.'));
});

const server = app.listen(PORT, () => {
  console.log(`OneTimeSuite dashboard listening on :${PORT} (${catalog.products.length} products in catalog)`);
});

module.exports = { app, server };
