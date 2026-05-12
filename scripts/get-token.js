#!/usr/bin/env node
// One-shot OAuth token helper for Shopify custom-distribution apps.
//
// Run this once per store to obtain a long-lived Admin API access token.
// The token does not expire automatically; it's revoked only when the app
// is uninstalled or when you rotate credentials.
//
// Usage:
//   npm run token                                       # prompts for shop
//   npm run token -- mystore.myshopify.com              # shop as CLI arg
//   SHOPIFY_SHOP=mystore.myshopify.com npm run token    # shop from env
//
// Why we hit /admin/oauth/authorize directly instead of using the Partner-
// dashboard "Custom distribution" install link: as of 2026 that link triggers
// Shopify's "managed installation", which installs the app server-side and
// redirects the browser to your App URL with hmac/host/shop/timestamp params
// — never hitting your Redirect URL, so there's no `code` to exchange. The
// /admin/oauth/authorize endpoint still runs the classic OAuth code flow.
//
// See docs/get-token.md for the full walkthrough.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Minimal .env loader (no dotenv dependency). Repo root only.
function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const [, k, raw] = m;
    if (process.env[k] !== undefined) continue;
    process.env[k] = raw.trim().replace(/^['"]|['"]$/g, '');
  }
}
loadEnv();

const API_KEY = process.env.SHOPIFY_API_KEY;
const API_SECRET = process.env.SHOPIFY_API_SECRET;
const PORT = Number(process.env.PORT || 4000);
const SCOPES = process.env.SHOPIFY_SCOPES || 'read_products';

if (!API_KEY || !API_SECRET) {
  console.error('Missing SHOPIFY_API_KEY or SHOPIFY_API_SECRET.');
  console.error('Set them in .env at the repo root (see .env.example).');
  process.exit(1);
}

async function getShopDomain() {
  let shop = process.argv[2] || process.env.SHOPIFY_SHOP;
  if (!shop) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    shop = await new Promise((resolve) => {
      rl.question('Shop domain (e.g. mystore.myshopify.com): ', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }
  shop = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!/^[a-z0-9-]+\.myshopify\.com$/i.test(shop)) {
    console.error(`Invalid shop domain: ${shop}`);
    console.error('Expected format: your-store.myshopify.com');
    process.exit(1);
  }
  return shop;
}

const shop = await getShopDomain();
const redirectUri = `http://localhost:${PORT}/callback`;
const state = crypto.randomBytes(16).toString('hex');
const authorizeUrl =
  `https://${shop}/admin/oauth/authorize` +
  `?client_id=${API_KEY}` +
  `&scope=${SCOPES}` +
  `&redirect_uri=${redirectUri}` +
  `&state=${state}`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname !== '/callback') {
    res.writeHead(404);
    res.end('Not found. Waiting for Shopify to hit /callback.');
    return;
  }

  const shopParam = url.searchParams.get('shop');
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');

  if (returnedState !== state) {
    res.writeHead(400);
    res.end('State mismatch — possible CSRF. Aborting.');
    setTimeout(() => { server.close(); process.exit(1); }, 250);
    return;
  }

  if (!shopParam || !code) {
    res.writeHead(400);
    res.end('Missing shop or code query parameter.');
    return;
  }

  if (!/^[a-z0-9-]+\.myshopify\.com$/i.test(shopParam)) {
    res.writeHead(400);
    res.end(`Unexpected shop domain: ${shopParam}`);
    return;
  }

  try {
    const tokenRes = await fetch(`https://${shopParam}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: API_KEY,
        client_secret: API_SECRET,
        code,
      }),
    });

    const body = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !body.access_token) {
      throw new Error(`Shopify returned ${tokenRes.status}: ${JSON.stringify(body)}`);
    }

    console.log('');
    console.log('  Shop:   ', shopParam);
    console.log('  Token:  ', body.access_token);
    console.log('  Scopes: ', body.scope || '(none returned)');
    console.log('');
    console.log('Prefix is shpca_ for custom-distribution apps, shpat_ otherwise — both work');
    console.log('identically. Paste into Virtuoso as the X-Shopify-Access-Token header value.');

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!doctype html>
<html><body style="font-family:system-ui,sans-serif;padding:2rem;max-width:560px">
  <h1>Token obtained</h1>
  <p>Check your terminal for the access token. Safe to close this tab.</p>
  <p><strong>Shop:</strong> ${shopParam}</p>
</body></html>`);

    setTimeout(() => { server.close(); process.exit(0); }, 250);
  } catch (err) {
    console.error('Token exchange failed:', err.message);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(`Token exchange failed: ${err.message}\n\nCheck terminal for details.`);
    setTimeout(() => { server.close(); process.exit(1); }, 250);
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('Open this URL in a browser where you are signed in to the store admin:');
  console.log('');
  console.log(`  ${authorizeUrl}`);
  console.log('');
  console.log(`Listening on ${redirectUri} — will exit once the token is obtained.`);
});
