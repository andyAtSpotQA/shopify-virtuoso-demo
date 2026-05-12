# Virtuoso Journey Blueprint

A full end-to-end Virtuoso journey that exercises the Shopify Admin API (create/publish/price/delete) **and** the React storefront UI (verify). Battle-tested against `*.myshopify.com` development stores.

**The flow:**

```
API  Create product (DRAFT → ACTIVE)
API  Add product image (from public URL)
API  Publish to Headless sales channel
API  Set initial price
UI   Browse storefront, assert product + price + image
API  Update price
UI   Refresh, assert new price
API  Delete product (cleanup)
```

---

## Prerequisites

Before building the journey:

1. **Admin API token** — `shpca_...` or `shpat_...`. See [`get-token.md`](./get-token.md). The token needs these scopes:
   - `read_products`, `write_products` — create / read / update / delete products
   - `read_publications`, `write_publications` — publish products to a sales channel
2. **Headless sales channel installed** on the store. In the store admin: **Apps → Shopify App Store → search "Headless" → Install**. Then **Create storefront** to get the public Storefront API token.
3. **Storefront API token** — set as `VITE_STOREFRONT_TOKEN` in `.env` so the React app reads from your real store.
4. **Your Headless channel's publication ID** — fetch it with the curl below.
5. **Public image URLs** for `productCreateMedia` to ingest. The demo uses [`github.com/andyAtSpotQA/filesForDemos`](https://github.com/andyAtSpotQA/filesForDemos/tree/main/product-images); raw URL pattern:
   ```
   https://raw.githubusercontent.com/andyAtSpotQA/filesForDemos/main/product-images/{design}/{item}.png
   ```
6. **Storefront running locally** — `npm run dev`. If using **Virtuoso Bridge**, the storefront must be reachable at your machine's `.local` hostname (e.g. `http://MY-MACHINE.local:5173`) — **raw LAN IPs give Bridge a blank page**.

---

## Discovering your Headless publication ID

Each store has its own publication ID. From a terminal:

```bash
curl -s -X POST https://YOUR-STORE.myshopify.com/admin/api/2025-01/graphql.json \
  -H "X-Shopify-Access-Token: shpca_YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ publications(first: 10) { edges { node { id name } } } }"}'
```

Look for the entry whose `name` matches your Headless storefront (e.g. `"My Store Headless"`). The `id` looks like `gid://shopify/Publication/292110106991`.

---

## Shared configuration in Virtuoso

Set these as environment variables / globals in Virtuoso so they're reusable across all API steps:

| Variable | Example | Notes |
|---|---|---|
| `shopDomain` | `your-store.myshopify.com` | |
| `apiVersion` | `2025-01` | |
| `adminToken` | `shpca_...` | The Admin API token |
| `publicationId` | `gid://shopify/Publication/...` | From the discovery curl above |
| `storefrontUrl` | `http://MY-MACHINE.local:5173` | Bridge: use `.local`; cloud: use a tunnel |

**Common API config (every Admin API step):**

```
Method:  POST
URL:     https://${shopDomain}/admin/api/${apiVersion}/graphql.json
Headers:
  X-Shopify-Access-Token: ${adminToken}
  Content-Type: application/json
```

**Per-test inputs** (test data variables — Virtuoso will pass these into the journey):

| Variable | Example | Purpose |
|---|---|---|
| `productTitle` | `Comet Integration Mug` | New product name |
| `productType` | `Mug` | Optional Shopify category |
| `vendor` | `VirtuosoQA` | Optional vendor field |
| `price` | `19.99` | Initial product price (string) |
| `updatedPrice` | `29.99` | Updated product price |
| `imageUrl` | `https://raw.githubusercontent.com/...` | Public image to attach |

---

## Step 1 — Create Product

Creates the product as **ACTIVE** so it's visible immediately (default is DRAFT).

**Body:**

```json
{
  "query": "mutation CreateProduct($input: ProductInput!) { productCreate(input: $input) { product { id handle title variants(first:1) { edges { node { id } } } } userErrors { field message } } }",
  "variables": {
    "input": {
      "title": "{{{productTitle}}}",
      "productType": "{{{productType}}}",
      "vendor": "{{{vendor}}}",
      "status": "ACTIVE"
    }
  }
}
```

**Extract from response:**

| Save as | Path |
|---|---|
| `productId` | `$response.data.data.productCreate.product.id` |
| `variantId` | `$response.data.data.productCreate.product.variants.edges[0].node.id` |
| `productHandle` | `$response.data.data.productCreate.product.handle` |

> **Note** — Shopify's 2025-01 API removed `variants` from `ProductInput`. You can't set the price during create; that's done in Step 4 against the auto-generated default variant (which starts at `0.00`).

---

## Step 2 — Add Product Image

Attaches a publicly-fetchable image to the product. Shopify downloads it and rehosts on their CDN.

**Body:**

```json
{
  "query": "mutation { productCreateMedia(productId: \"{{{productId}}}\", media: [{originalSource: \"{{{imageUrl}}}\", mediaContentType: IMAGE}]) { media { preview { image { url } } } mediaUserErrors { field message } } }"
}
```

The `productCreateMedia.mediaUserErrors` array will be empty on success. The `preview.image` field may be `null` for a few seconds while Shopify processes the image — that's fine.

---

## Step 3 — Publish to Headless Channel

Without this, the product is invisible to your storefront — `read_products` on the Storefront API only returns products published to the Storefront API's channel.

**Body:**

```json
{
  "query": "mutation { publishablePublish(id: \"{{{productId}}}\", input: [{publicationId: \"{{{publicationId}}}\"}]) { publishable { availablePublicationsCount { count } } userErrors { field message } } }"
}
```

---

## Step 4 — Set Initial Price

Note that this is `productVariantsBulkUpdate`, not `productVariantUpdate` — the latter was removed in API 2025-01.

**Body:**

```json
{
  "query": "mutation UpdatePrice($productId: ID!, $variants: [ProductVariantsBulkInput!]!) { productVariantsBulkUpdate(productId: $productId, variants: $variants) { productVariants { id price } userErrors { field message } } }",
  "variables": {
    "productId": "{{{productId}}}",
    "variants": [{"id": "{{{variantId}}}", "price": "{{{price}}}"}]
  }
}
```

---

## Step 5 — UI Verify (initial price)

In the browser, navigate to:

```
${storefrontUrl}
```

**Assertions:**
- Product card with title `{{{productTitle}}}` is present (selector: `[data-testid="product-card"]`)
- Click into it (use `[data-handle="..."]` if you want to target precisely via `productHandle`)
- Detail page price matches `{{{price}}}` formatted as currency

> **Caching note** — Shopify's Storefront API caches aggressively. After Step 4 the new product may take 3–5 seconds to be visible. Add a short wait *or* use the cache-busting trick documented in "Operational notes" below.

---

## Step 6 — Update Price

Same mutation as Step 4 — only the price value changes. Use Virtuoso's `{{{updatedPrice}}}` variable so this step has its own value distinct from Step 4.

**Body:**

```json
{
  "query": "mutation UpdatePrice($productId: ID!, $variants: [ProductVariantsBulkInput!]!) { productVariantsBulkUpdate(productId: $productId, variants: $variants) { productVariants { id price } userErrors { field message } } }",
  "variables": {
    "productId": "{{{productId}}}",
    "variants": [{"id": "{{{variantId}}}", "price": "{{{updatedPrice}}}"}]
  }
}
```

---

## Step 7 — UI Verify (new price)

Reload the product page in the browser:

```javascript
location.reload();
```

Or navigate to `${storefrontUrl}/product/{{{productHandle}}}`.

**Assertions:**
- Price displayed matches `{{{updatedPrice}}}` (not `{{{price}}}`)

Again, wait 3–5 seconds after Step 6 for the Storefront API cache to invalidate.

---

## Step 8 — Delete Product (cleanup)

Removes the product entirely. Without this, every journey run accumulates test products on the store.

**Body:**

```json
{
  "query": "mutation { productDelete(input: {id: \"{{{productId}}}\"}) { deletedProductId userErrors { field message } } }"
}
```

---

## Helper: random product picker (JS extension)

If you want the journey to vary which product/design/colour it tests each run, use this Virtuoso JavaScript extension. It fetches the `filesForDemos` repo via the GitHub API and returns a random product's metadata + image URL.

```javascript
/**
 * Select a random product from a GitHub directory and return its characteristics
 * @async Make sure that "Run asynchronously" is checked
 * @param url The URL of the GitHub directory containing product images
 * @returns An object containing the product's name, color, type, and image URL
 * @example Execute getRandomProduct("https://github.com/andyAtSpotQA/filesForDemos/tree/main/product-images") returning $result
 */
getRandomProduct(url).then(done).catch(doneError);

async function getRandomProduct(url) {
    var match = url.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)/);
    if (!match) throw new Error("Invalid GitHub URL: " + url);
    var owner = match[1], repo = match[2], branch = match[3], path = match[4];

    var dirsRes = await fetch(
        "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + path + "?ref=" + branch
    );
    if (!dirsRes.ok) throw new Error("GitHub API error: " + dirsRes.status);
    var dirs = (await dirsRes.json()).filter(function(d) { return d.type === "dir"; });
    if (dirs.length === 0) throw new Error("No product directories found");

    var randomDir = dirs[Math.floor(Math.random() * dirs.length)];

    var filesRes = await fetch(randomDir.url);
    if (!filesRes.ok) throw new Error("GitHub API error: " + filesRes.status);
    var images = (await filesRes.json()).filter(function(f) {
        return f.name.endsWith(".png") || f.name.endsWith(".jpg");
    });
    if (images.length === 0) throw new Error("No images in " + randomDir.name);

    var randomImage = images[Math.floor(Math.random() * images.length)];

    var name = randomDir.name.split("_").map(function(w) {
        return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(" ");

    var parts = randomImage.name.replace(/\.\w+$/, "").split("_");
    var color = "", productType = "";
    if (parts.length >= 2) {
        color = parts[parts.length - 1].charAt(0).toUpperCase() + parts[parts.length - 1].slice(1);
        productType = parts.slice(0, -1).map(function(w) {
            return w.charAt(0).toUpperCase() + w.slice(1);
        }).join(" ");
    } else {
        productType = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    }

    return {
        name: name,
        color: color,
        productType: productType,
        imageUrl: "https://raw.githubusercontent.com/" + owner + "/" + repo + "/" + branch + "/" + path + "/" + randomDir.name + "/" + randomImage.name,
        productTitle: name + " " + productType + (color ? " - " + color : "")
    };
}
```

**Usage in Virtuoso:** `Execute getRandomProduct("https://github.com/andyAtSpotQA/filesForDemos/tree/main/product-images") returning $result`

Then reference `$result.productTitle`, `$result.imageUrl`, `$result.productType`, etc. as inputs to Step 1.

---

## Operational notes

### Storefront caching after price updates

The Shopify Storefront API caches at the edge (Cloudflare). A price update via the Admin API doesn't immediately invalidate the cache. Mitigations, in order of effort:

1. **Wait 3–5 seconds** between the Admin API write and the storefront verify step. Simplest, almost always sufficient.
2. **Cache-bust at fetch time** — append a `?t=<timestamp>` query param on every Storefront API call. Already implemented in `src/api.ts`.
3. **Hard reload** — `location.reload(true)` (or `location.reload()` and trust the cache-buster).

### Reaching the dev server from Virtuoso Bridge

The browser running inside Bridge needs a hostname that resolves both on the test runner's machine and at the OS level. **Use your machine's `.local` mDNS hostname**, not a raw LAN IP:

```
✅ http://MY-MACHINE.local:5173
❌ http://10.0.0.43:5173        # gives Bridge a blank page
```

To find your `.local` name on macOS: System Settings → General → Sharing → Local Hostname.

### When the customer is cloud-only (Bridge not available)

If a prospect can't use Bridge (cloud-only Virtuoso, no local machine in the pipeline), 503s from anonymous storefront pages become much more likely. Tactics:

- **Persist the Cloudflare `cf_clearance` cookie** across journeys — one journey passes the bot challenge, the rest piggyback.
- **Move setup to the API path** — use the Storefront Cart API to build carts authenticated, only navigate the browser for the final checkout-screen assertion. Massively reduces anonymous page hits.
- **Stagger journey starts** with 5–15 sec jitter even when parallel.
- **Engage Shopify support to allowlist Virtuoso's egress IPs** — Plus customers can request this through their account manager.
- **For Shopify Plus** — ask if they have a dedicated origin URL that bypasses the public Cloudflare edge for trusted sources.

### Rate-limiting story (Admin API)

Every Admin API response includes a `throttleStatus` field:

```json
"throttleStatus": {
  "maximumAvailable": 2000.0,
  "currentlyAvailable": 1990,
  "restoreRate": 100.0
}
```

This is point-based — different queries cost different amounts (see `actualQueryCost`). Useful for prospects worried about rate limits: Virtuoso can assert on `throttleStatus.currentlyAvailable` dropping across steps, or deliberately exhaust the bucket to demo 429 handling.

The Storefront API has separate, much more lenient limits. When a prospect says "we're hitting rate limits", clarify which API — the playbooks are different.

---

## Demo audience

`docs/get-token.md` and `scripts/get-token.js` are **prospect-facing demo deliverables**, not throwaway helpers. Keep them accurate and replicable — drift will break demos. Same goes for this journey blueprint.
