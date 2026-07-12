// Whop OAuth 2.1 + PKCE and API helpers.
// Endpoints verified against https://docs.whop.com/developer/guides/oauth (2026-07):
//   authorize:  GET  https://api.whop.com/oauth/authorize
//   token:      POST https://api.whop.com/oauth/token   (JSON body)
//   userinfo:   GET  https://api.whop.com/oauth/userinfo (Bearer <access_token>)
//   memberships GET  https://api.whop.com/api/v1/memberships (Bearer user token OR company API key)
const crypto = require('crypto');

const AUTHORIZE_URL = 'https://api.whop.com/oauth/authorize';
const TOKEN_URL = 'https://api.whop.com/oauth/token';
const USERINFO_URL = 'https://api.whop.com/oauth/userinfo';
const MEMBERSHIPS_URL = 'https://api.whop.com/api/v1/memberships';

function b64url(buf) {
  return buf.toString('base64url');
}

// PKCE pair: verifier is random, challenge = base64url(sha256(verifier))
function createPkce() {
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

function createState() {
  return b64url(crypto.randomBytes(16));
}

function buildAuthorizeUrl({ clientId, redirectUri, state, codeChallenge }) {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'openid profile');
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

async function exchangeCode({ code, redirectUri, clientId, clientSecret, codeVerifier }) {
  const body = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  };
  if (clientSecret) body.client_secret = clientSecret;
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Token exchange failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return res.json(); // { access_token, refresh_token, id_token?, token_type, expires_in }
}

async function getUserInfo(accessToken) {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`userinfo failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return res.json(); // { sub, name?, preferred_username?, picture?, ... }
}

async function fetchMembershipPage(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`memberships failed (${res.status}): ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/**
 * List the user's memberships. Tries the user's OAuth access token first;
 * if that is rejected and a company API key is configured, falls back to the
 * company key filtered by user id.
 * Returns [{ id, status, productId, productTitle }]
 */
async function listUserMemberships({ accessToken, userId, apiKey, companyId }) {
  const collect = async (baseParams, token) => {
    const out = [];
    let after = null;
    for (let page = 0; page < 10; page++) {
      const url = new URL(MEMBERSHIPS_URL);
      for (const [k, v] of Object.entries(baseParams)) url.searchParams.set(k, v);
      if (after) url.searchParams.set('after', after);
      const json = await fetchMembershipPage(url.toString(), token);
      const rows = Array.isArray(json.data) ? json.data : [];
      for (const m of rows) {
        out.push({
          id: m.id,
          status: m.status,
          productId: (m.product && m.product.id) || m.product_id || null,
          productTitle: (m.product && m.product.title) || null,
        });
      }
      const pi = json.page_info || {};
      if (!pi.has_next_page || !pi.end_cursor) break;
      after = pi.end_cursor;
    }
    return out;
  };

  try {
    return await collect({}, accessToken);
  } catch (err) {
    if (apiKey && companyId && userId) {
      // Fall back to company-scoped listing filtered to this user
      return collect({ company_id: companyId, user_ids: userId }, apiKey);
    }
    throw err;
  }
}

module.exports = {
  AUTHORIZE_URL,
  TOKEN_URL,
  USERINFO_URL,
  MEMBERSHIPS_URL,
  createPkce,
  createState,
  buildAuthorizeUrl,
  exchangeCode,
  getUserInfo,
  listUserMemberships,
};
