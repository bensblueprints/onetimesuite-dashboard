/*
 * Resolves the current installer download for an app, straight from its public
 * releases repo on GitHub.
 *
 * Deliberately lazy: we look a release up when a customer actually clicks
 * Download, not on a timer for all 101 apps. Unauthenticated GitHub allows
 * 60 requests/hour per IP — polling the whole catalogue would blow that
 * instantly, whereas per-click lookups (cached for an hour) stay far under it.
 * Set GITHUB_TOKEN in the environment to raise the ceiling if it ever matters.
 *
 * Installers live in a separate PUBLIC "<repo>-releases" repo so the product
 * source can stay private. A few apps predate that convention — see OVERRIDES.
 */
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map(); // repo -> { at, release }

// Apps whose installers do not live in "<repo>-releases".
const OVERRIDES = {
  wispertalk: 'wispertalk-releases',
  bloomrecorder: 'bloomrecorder-releases',
  orgtree: 'wholeteam-mvp',
};

function releasesRepo(product) {
  if (!product) return null;
  if (OVERRIDES[product.slug]) return OVERRIDES[product.slug];
  return product.repo ? `${product.repo}-releases` : null;
}

async function fetchLatestRelease(repo) {
  const hit = cache.get(repo);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.release;

  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'onetimesuite-dashboard' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  let release = null;
  try {
    const res = await fetch(`https://api.github.com/repos/bensblueprints/${repo}/releases/latest`, { headers });
    if (res.ok) release = await res.json();
    // 404 => no release published yet. Cache that too, so a missing release
    // doesn't mean a GitHub call on every single page view.
  } catch {
    /* network blip — cache the null briefly and try again next hour */
  }
  cache.set(repo, { at: Date.now(), release });
  return release;
}

/** Pick the asset for a platform. 'win' | 'mac' | 'mac-arm' */
function pickAsset(release, platform) {
  const assets = (release && release.assets) || [];
  const named = (re) => assets.filter((a) => re.test(a.name));
  if (platform === 'win') {
    // prefer the installer over a portable build
    return named(/\.exe$/i).find((a) => /setup/i.test(a.name)) || named(/\.exe$/i)[0] || null;
  }
  if (platform === 'mac-arm') return named(/arm64\.dmg$/i)[0] || named(/\.dmg$/i)[0] || null;
  if (platform === 'mac') return named(/\.dmg$/i).find((a) => !/arm64/i.test(a.name)) || named(/arm64\.dmg$/i)[0] || null;
  return null;
}

/**
 * What the dashboard needs to render a card: which platforms are downloadable
 * and at what version. Returns null when the app has no published installers
 * (most of the web/self-hosted apps, and desktop apps not yet built).
 */
async function downloadInfo(product) {
  const repo = releasesRepo(product);
  if (!repo) return null;
  const release = await fetchLatestRelease(repo);
  if (!release || !Array.isArray(release.assets) || !release.assets.length) return null;
  const win = pickAsset(release, 'win');
  const macArm = pickAsset(release, 'mac-arm');
  const macIntel = pickAsset(release, 'mac');
  if (!win && !macArm && !macIntel) return null;
  return {
    repo,
    version: String(release.tag_name || '').replace(/^v/, ''),
    win: win ? win.browser_download_url : null,
    macArm: macArm ? macArm.browser_download_url : null,
    // only advertise a separate Intel build when it really is a different file
    macIntel: macIntel && (!macArm || macIntel.name !== macArm.name) ? macIntel.browser_download_url : null,
  };
}

module.exports = { downloadInfo, releasesRepo, fetchLatestRelease, pickAsset };
