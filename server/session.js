// Signed cookie sessions — zero deps beyond node:crypto.
// Cookie value: base64url(JSON payload) + "." + base64url(HMAC-SHA256 signature)
const crypto = require('crypto');

const COOKIE_NAME = 'ots_session';
const OAUTH_COOKIE_NAME = 'ots_oauth'; // short-lived state+PKCE verifier during the redirect dance

function secret() {
  return process.env.SESSION_SECRET || '';
}

function sign(payloadB64) {
  return crypto.createHmac('sha256', secret()).update(payloadB64).digest('base64url');
}

function encode(obj) {
  const payload = Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function decode(value) {
  if (!value || typeof value !== 'string') return null;
  const idx = value.lastIndexOf('.');
  if (idx < 1) return null;
  const payload = value.slice(0, idx);
  const sig = value.slice(idx + 1);
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const obj = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (obj.exp && Date.now() > obj.exp) return null;
    return obj;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

function cookieString(name, value, maxAgeSeconds) {
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (process.env.NODE_ENV === 'production') attrs.push('Secure');
  if (maxAgeSeconds != null) attrs.push(`Max-Age=${maxAgeSeconds}`);
  return attrs.join('; ');
}

function getSession(req) {
  return decode(parseCookies(req)[COOKIE_NAME]);
}

function setSession(res, data, maxAgeSeconds = 7 * 24 * 3600) {
  const value = encode({ ...data, exp: Date.now() + maxAgeSeconds * 1000 });
  res.append('Set-Cookie', cookieString(COOKIE_NAME, value, maxAgeSeconds));
}

function clearSession(res) {
  res.append('Set-Cookie', cookieString(COOKIE_NAME, '', 0));
}

function getOauthState(req) {
  return decode(parseCookies(req)[OAUTH_COOKIE_NAME]);
}

function setOauthState(res, data, maxAgeSeconds = 600) {
  const value = encode({ ...data, exp: Date.now() + maxAgeSeconds * 1000 });
  res.append('Set-Cookie', cookieString(OAUTH_COOKIE_NAME, value, maxAgeSeconds));
}

function clearOauthState(res) {
  res.append('Set-Cookie', cookieString(OAUTH_COOKIE_NAME, '', 0));
}

module.exports = {
  getSession,
  setSession,
  clearSession,
  getOauthState,
  setOauthState,
  clearOauthState,
};
