// Smoke test — boots the real server with fake env on a random port.
// NO network calls to Whop are made: we only hit routes that return before
// any outbound fetch (/, /login redirect, /callback without code).
const assert = require('assert');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 5399;
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = path.resolve(__dirname, '..');

async function waitForServer(timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/healthz`);
      if (res.ok) return res.json();
    } catch {
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  throw new Error('server did not start in time');
}

async function main() {
  let failed = 0;
  const pass = (name) => console.log(`  ok   ${name}`);
  const fail = (name, err) => { failed++; console.error(`  FAIL ${name}: ${err.message}`); };
  const check = (name, fn) => Promise.resolve().then(fn).then(() => pass(name), (e) => fail(name, e));

  // 1. catalog.json loads with 100+ entries
  await check('catalog.json loads with 100+ product entries', () => {
    const catalog = require(path.join(ROOT, 'catalog.json'));
    assert.ok(Array.isArray(catalog.products), 'catalog.products is an array');
    assert.ok(catalog.products.length >= 100, `expected >=100 products, got ${catalog.products.length}`);
    assert.strictEqual(catalog.companyId, 'biz_Ro2hWjwgeK5rm8');
    assert.strictEqual(catalog.bundle.productId, 'prod_deLvZPOasRITY');
    for (const p of catalog.products) {
      assert.ok(p.slug && p.title && p.productId && p.repo, `entry missing fields: ${JSON.stringify(p)}`);
    }
  });

  // Boot server with fake env
  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'index.js')], {
    env: {
      ...process.env,
      PORT: String(PORT),
      SESSION_SECRET: 'smoke-test-secret',
      WHOP_OAUTH_CLIENT_ID: 'app_FAKE123',
      WHOP_OAUTH_CLIENT_SECRET: 'fake-secret',
      REDIRECT_URI: `http://127.0.0.1:${PORT}/callback`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));

  try {
    await waitForServer();
    pass('server boots with fake env');

    // 2. GET / returns the login page
    await check('GET / returns login page', async () => {
      const res = await fetch(`${BASE}/`);
      assert.strictEqual(res.status, 200);
      const html = await res.text();
      assert.ok(html.includes('See your OneTimeSuite library'), 'login headline present');
      assert.ok(html.includes('/login'), 'login link present');
    });

    // 3. GET /login redirects to whop.com authorize URL (do NOT follow it)
    await check('GET /login redirects to Whop OAuth', async () => {
      const res = await fetch(`${BASE}/login`, { redirect: 'manual' });
      assert.ok([301, 302, 303, 307].includes(res.status), `expected redirect, got ${res.status}`);
      const loc = res.headers.get('location');
      const url = new URL(loc);
      assert.ok(/(^|\.)whop\.com$/.test(url.hostname), `redirect host is whop.com (got ${url.hostname})`);
      assert.ok(url.pathname.includes('/oauth/authorize'), 'authorize path');
      assert.strictEqual(url.searchParams.get('response_type'), 'code');
      assert.strictEqual(url.searchParams.get('client_id'), 'app_FAKE123');
      assert.strictEqual(url.searchParams.get('redirect_uri'), `http://127.0.0.1:${PORT}/callback`);
      assert.ok(url.searchParams.get('state'), 'state param set');
      assert.strictEqual(url.searchParams.get('code_challenge_method'), 'S256');
      assert.ok(url.searchParams.get('code_challenge'), 'PKCE challenge set');
      assert.ok(res.headers.get('set-cookie').includes('ots_oauth='), 'oauth state cookie set');
    });

    // 4. GET /callback without code errors cleanly (no network hit)
    await check('GET /callback without code errors cleanly', async () => {
      const res = await fetch(`${BASE}/callback`);
      assert.strictEqual(res.status, 400);
      const html = await res.text();
      assert.ok(html.includes('Missing authorization code'), 'clean error message');
    });

    // 5. GET /callback with provider error errors cleanly
    await check('GET /callback with error param errors cleanly', async () => {
      const res = await fetch(`${BASE}/callback?error=access_denied`);
      assert.strictEqual(res.status, 400);
      const html = await res.text();
      assert.ok(html.includes('access_denied'), 'error surfaced');
    });

    // 6. GET /callback with code but bad state is rejected before token exchange
    await check('GET /callback with forged state is rejected', async () => {
      const res = await fetch(`${BASE}/callback?code=fake&state=nope`);
      assert.strictEqual(res.status, 400);
      const html = await res.text();
      assert.ok(html.includes('State mismatch'), 'state mismatch message');
    });
  } finally {
    child.kill();
  }

  if (failed > 0) {
    console.error(`\n${failed} check(s) FAILED`);
    process.exit(1);
  }
  console.log('\nAll smoke checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
