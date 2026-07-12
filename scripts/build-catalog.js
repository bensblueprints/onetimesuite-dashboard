#!/usr/bin/env node
/**
 * Bakes catalog.json for the dashboard.
 *
 * Sources (dev machine only — the baked catalog.json is committed, so this
 * script is NOT needed at runtime or in Docker):
 *   - ../whop-publish-results.json      (slug -> productId, title, price, productUrl)
 *   - ../../onetimesuite-com/src/products.js + products-51-100.js (slug -> repo, brand)
 *
 * Output: catalog.json — array of { slug, title, brand, productId, repo, price }
 * The bundle product (OneTimeSuite Complete) is kept as a separate top-level key.
 */
const fs = require('fs');
const path = require('path');

const PUBLISH_RESULTS = path.resolve(__dirname, '..', '..', 'whop-publish-results.json');
const PRODUCTS_A = path.resolve(__dirname, '..', '..', '..', 'onetimesuite-com', 'src', 'products.js');
const PRODUCTS_B = path.resolve(__dirname, '..', '..', '..', 'onetimesuite-com', 'src', 'products-51-100.js');
const OUT = path.resolve(__dirname, '..', 'catalog.json');

const BUNDLE_PRODUCT_ID = 'prod_deLvZPOasRITY';

const publish = JSON.parse(fs.readFileSync(PUBLISH_RESULTS, 'utf8'));
const products = [...require(PRODUCTS_A), ...require(PRODUCTS_B)];
const bySlug = new Map(products.map((p) => [p.slug, p]));

const items = [];
let bundle = null;

for (const [slug, entry] of Object.entries(publish)) {
  if (!entry.productId) continue;
  if (entry.productId === BUNDLE_PRODUCT_ID) {
    bundle = {
      slug,
      productId: entry.productId,
      title: entry.title || 'OneTimeSuite Complete',
      price: entry.price || null,
      productUrl: entry.productUrl || null,
    };
    continue;
  }
  const def = bySlug.get(slug);
  if (!def) {
    console.warn(`[build-catalog] no repo mapping for slug "${slug}" — skipping`);
    continue;
  }
  items.push({
    slug,
    title: entry.title || def.brand,
    brand: def.brand,
    productId: entry.productId,
    repo: def.repo,
    price: typeof entry.price === 'number' ? entry.price : def.price,
    icon: def.icon || null,
  });
}

items.sort((a, b) => a.slug.localeCompare(b.slug));

const out = {
  generatedAt: new Date().toISOString(),
  companyId: 'biz_Ro2hWjwgeK5rm8',
  bundle,
  products: items,
};

fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(`[build-catalog] wrote ${items.length} products + bundle=${bundle ? bundle.productId : 'MISSING'} -> ${OUT}`);
