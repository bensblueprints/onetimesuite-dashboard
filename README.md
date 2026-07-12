# OneTimeSuite Customer Dashboard

Self-hosted "Login with Whop" dashboard for OneTimeSuite customers.
A customer signs in with the Whop account they purchased with and sees every
OneTimeSuite product they own, each with links to:

- the GitHub repo (`github.com/bensblueprints/<repo>`)
- the app subdomain (`https://<slug>.onetimesuite.com`)
- the marketing page (`https://onetimesuite.com/<slug>/`)

If the customer owns the **OneTimeSuite Complete** bundle
(`prod_deLvZPOasRITY`), the entire catalog is shown as owned.

Stack: plain Node 20 + Express, no TypeScript, no build step, no native deps.
Server-rendered HTML (template literals), signed-cookie sessions.

## How it works

1. `GET /login` — generates OAuth `state` + a PKCE verifier/challenge pair,
   stores them in a short-lived signed cookie, and redirects to
   `https://api.whop.com/oauth/authorize?response_type=code&client_id=...&redirect_uri=...&scope=openid+profile&state=...&code_challenge=...&code_challenge_method=S256`
2. `GET /callback` — verifies `state`, then server-side POSTs to
   `https://api.whop.com/oauth/token` (JSON body: `grant_type=authorization_code`,
   `code`, `redirect_uri`, `client_id`, `client_secret`, `code_verifier`),
   fetches `https://api.whop.com/oauth/userinfo` with the access token, then
   lists the user's memberships from `https://api.whop.com/api/v1/memberships`
   (user Bearer token; falls back to `WHOP_API_KEY` + `company_id` + `user_ids`
   if the user token is not accepted). The relevant memberships are stored in
   a signed session cookie.
3. `GET /` — login page when signed out; owned-products dashboard when signed
   in. Only memberships matching OneTimeSuite catalog product IDs
   (company `biz_Ro2hWjwgeK5rm8`) are shown. Statuses counted as owned:
   `active`, `trialing`, `completed`.

The product catalog is **baked** into `catalog.json` (slug, title, productId,
repo, price) by `scripts/build-catalog.js`, which reads
`../whop-publish-results.json` and `../../onetimesuite-com/src/products*.js`
on the dev machine. `catalog.json` is committed, so runtime/Docker never needs
those source files. Re-run `npm run build:catalog` after publishing new
products.

## Whop dashboard setup (one time)

1. Go to <https://whop.com/dashboard> for the **benjisaiempire** company
   (company id `biz_Ro2hWjwgeK5rm8`).
2. Open **Developer** settings (whop.com/dashboard/developer) and **Create app**
   — name it e.g. "OneTimeSuite Dashboard".
3. In the app's **OAuth / redirect settings**, add the redirect URI exactly:
   `https://dashboard.onetimesuite.com/callback`
   (add `http://localhost:5375/callback` too if you want local testing).
4. Copy the **Client ID** (`app_...`) and **Client Secret** into `.env` as
   `WHOP_OAUTH_CLIENT_ID` / `WHOP_OAUTH_CLIENT_SECRET`.
5. (Optional) Copy a company **API key** into `WHOP_API_KEY` — used only as a
   fallback for membership lookups.

## Environment variables

| Var | Required | Description |
| --- | --- | --- |
| `WHOP_OAUTH_CLIENT_ID` | yes | OAuth app client id (`app_...`) from the Whop developer dashboard |
| `WHOP_OAUTH_CLIENT_SECRET` | yes | OAuth app client secret |
| `WHOP_API_KEY` | no | Company API key; fallback for server-side membership lookups |
| `REDIRECT_URI` | yes | `https://dashboard.onetimesuite.com/callback` (must exactly match the Whop app config) |
| `SESSION_SECRET` | yes | Long random string for signing session cookies (`openssl rand -hex 32`) |
| `PORT` | no | Defaults to `5375` |

Copy `.env.example` to `.env` and fill it in.

## Run

```bash
npm install
npm start            # http://localhost:5375
npm test             # smoke test (no network calls to Whop)
npm run build:catalog  # re-bake catalog.json (dev machine only)
```

## Docker

```bash
docker build -t onetimesuite-dashboard .
docker run -p 5375:5375 --env-file .env onetimesuite-dashboard
```

## Routes

- `GET /` — login page or dashboard
- `GET /login` — start Whop OAuth
- `GET /callback` — OAuth redirect target
- `GET /logout` — clear session
- `GET /healthz` — JSON health check
