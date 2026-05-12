# Getting a Shopify Admin API access token (for Virtuoso API testing)

**Audience:** a tester who wants Virtuoso (or any HTTP test tool) to hit the Shopify Admin API for their own store. Replaces the now-retired "legacy custom app" path that Shopify disabled for new creations on 2026-01-01.

**Time:** ~5 minutes end-to-end. The token does not expire automatically.

---

## What you'll end up with

- A long-lived Admin API access token for your store. Prefix is `shpca_...` for custom-distribution apps (what this guide produces) or `shpat_...` for other app types — both work identically as the `X-Shopify-Access-Token` header value.
- A custom app in your Shopify Partner account that you can reuse on other stores to mint more tokens.

## Prerequisites

- A Shopify Partner account (free — sign up at https://partners.shopify.com if you don't have one).
- Admin access to the Shopify store you want to test against.
- Node.js 18 or newer on your machine.
- This repo checked out locally.

---

## Steps

### 1. Create a custom app in the Partner dashboard

1. https://partners.shopify.com → **App distribution** → **Create app** → **Create app manually**.
2. Name: anything (e.g. "API Test Harness"). App URL: `https://example.com`. Click Create.

### 2. Configure scopes and redirect URL

Open the app → **Configuration** → **Access** section:

1. **Scopes**: add the Admin API scopes your tests need. `read_products` is enough for a hello-world. Common additions: `read_orders`, `read_customers`, `read_inventory`.
2. **Redirect URLs**: add `http://localhost:4000/callback` *(must match the `PORT` in your `.env` — default 4000)*.

Click **Save**, then **Release** to publish the first version.

> **Note:** the "Use legacy install flow" and "Embed app in Shopify admin" toggles do **not** affect this flow — we call Shopify's OAuth authorize endpoint directly rather than using the Partner-dashboard install link. As of 2026 the Custom-distribution install link triggers "managed installation" that bypasses your Redirect URL, so we skip it entirely.

### 3. Make the app installable on your store

In the Partner dashboard: your app → **Distribution** → **Custom distribution** → pick your store → save. You do **not** need to use the generated install link — step 5 uses OAuth directly against the store. This step just registers the app as allowed on that store.

### 4. Grab the app credentials

In the Partner dashboard: **Dev Dashboard** (linked from the app page) → **Settings** → **Credentials**. Copy:

- **Client ID** → `SHOPIFY_API_KEY`
- **Client secret** → `SHOPIFY_API_SECRET`

Put them in `.env` at the repo root (copy from `.env.example`):

```
SHOPIFY_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SHOPIFY_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

`.env` is gitignored. Don't commit it.

### 5. Start the token helper

```bash
npm run token
```

It prompts for the shop domain (e.g. `your-store.myshopify.com`). You can also pass it as a CLI arg or env var:

```bash
npm run token -- your-store.myshopify.com
# or
SHOPIFY_SHOP=your-store.myshopify.com npm run token
```

The helper then:

1. Builds an OAuth authorize URL for your store.
2. Starts a tiny HTTP server on `http://localhost:4000/callback`.
3. Prints the authorize URL to your terminal.

### 6. Authorize the app

Open the printed authorize URL in a browser where you're logged into the store's admin. Shopify shows a permissions page listing your requested scopes — click **Install app** (or **Update app** if the app is already installed).

Shopify redirects the browser to `http://localhost:4000/callback?code=...&shop=...&state=...`. The helper:

1. Verifies the `state` param (CSRF guard).
2. Exchanges the `code` for an access token via Shopify's OAuth endpoint.
3. Prints the token (`shpca_...` or `shpat_...`) to your terminal.
4. Exits.

You'll also see a "Token obtained" confirmation page in the browser.

### 7. Use the token in Virtuoso

Create an API test with:

```
Method:  POST
URL:     https://YOUR-STORE.myshopify.com/admin/api/2025-01/graphql.json
Headers:
  X-Shopify-Access-Token: shpca_xxxxxxxxxxxxxxxxxxxxxxxx
  Content-Type: application/json
Body (raw JSON):
  { "query": "{ shop { name myshopifyDomain } }" }
```

Expected response: `200` with `data.shop.name` matching your store.

---

## Troubleshooting

- **Browser lands on `https://example.com/?hmac=...&host=...&shop=...`** — you clicked the Partner-dashboard "Custom distribution" install link instead of the authorize URL printed by `npm run token`. That install link runs managed installation, which bypasses OAuth. Use the authorize URL from the terminal.
- **`State mismatch` error** — the `state` param didn't round-trip. Start `npm run token` again (a fresh state is generated per run) and use the new authorize URL.
- **`401 Unauthorized`** — wrong token, or the token was revoked (app uninstalled).
- **`403 Forbidden`** — token is valid but the query needs a scope you didn't request. Edit the app's scopes, Release a new version, and re-run `npm run token` to mint a new token with the updated scopes.
- **Helper logs `Shopify returned 400`** — the `code` was already used (single-use) or expired. Re-run `npm run token` for a fresh authorize URL.
- **Browser redirects to `example.com` instead of `localhost` after clicking Install on the authorize URL** — the app's Redirect URL isn't `http://localhost:4000/callback` on the released version. Fix it, create a new version, Release, re-run the helper.

## How this differs from "legacy custom apps"

The in-admin **Settings → Apps → Develop apps** flow was the simplest way to get an Admin API token for years. Shopify retired it for new creations on 2026-01-01. This document uses the modern Partner-dashboard + OAuth path, which produces a functionally identical access token and will remain supported.
