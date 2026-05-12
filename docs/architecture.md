# Architecture Overview

## Purpose

A minimal React storefront + Shopify integration deliberately built as a **test target for Virtuoso** (UI + API automation). It is **not** a production e-commerce app — every architectural decision is in service of being a stable, predictable target for automated tests against real Shopify infrastructure.

---

## System topology

```
┌─────────────────┐         ┌────────────────────────┐
│ React storefront│ ──read──▶│ Shopify Storefront API │
│ (Vite, :5173)   │         │ (cached, lenient limits)│
└────────┬────────┘         └─────────▲──────────────┘
         │                            │
         │ localStorage cart           │ creates/updates
         │ (client-only, no backend)   │ products
         │                            │
         ▼                   ┌────────┴───────┐
   "Checkout"                │ Shopify Admin   │
   (clears cart,             │ API (token via  │
    no payment)              │ OAuth helper)   │
                             └─────────────────┘
                                      ▲
                                      │
                       ┌──────────────┴──────────────┐
                       │ scripts/get-token.js        │
                       │ (mints shpca_ token via     │
                       │  /admin/oauth/authorize)    │
                       └─────────────────────────────┘
```

**Data flow at a glance:**

- **React app reads** product data from Shopify's Storefront API (public token, read-only, lenient rate limits). Falls back to `mock.shop` if env vars are absent.
- **Virtuoso API journeys write** to Shopify via the Admin API (private `shpca_` token, full CRUD, point-based rate limit) — creating, publishing, pricing, and deleting test products.
- **Cart is client-only**, lives in `localStorage`, never touches a server.
- **"Checkout" is fake** — it clears the cart and renders a confirmation. There is no payment integration, no order created in Shopify.

---

## Key architectural decisions

### 1. `src/api.ts` is a single thin GraphQL client

No codegen pipeline, no Apollo, no React Query. Two functions: `fetchProducts`, `fetchProductByHandle`. Easy to read, easy to swap data source. Originally hit `mock.shop`; now points at a real store via `VITE_SHOPIFY_STORE` / `VITE_STOREFRONT_TOKEN` env vars, falling back to `mock.shop` if either is unset.

This is deliberate — small surface area, predictable for Virtuoso assertions, low cognitive load when debugging a flaky test.

### 2. Cart is client-only via localStorage + pub/sub

No Redux, no React Context. Components call `cart.get()` once and re-render on `cart.subscribe()` events. Means cart state is observable from the DOM but doesn't survive cross-device — fine for the demo, intentionally simple.

### 3. Every interactive element has a stable `data-testid`

`product-card`, `add-to-cart`, `cart-line`, `cart-subtotal`, `checkout`, `nav-cart`, `cart-count`. Plus `data-handle` on product cards/detail pages and `data-variant-id` on cart lines for targeted selection.

This is the contract with Virtuoso. **Preserve these when editing** — they're what journeys are written against.

### 4. Storefront read path is separate from Admin write path

Two different APIs, two different auth flows, two different rate-limit models:

| | Storefront API | Admin API |
|---|---|---|
| Used by | React app (browser) | Virtuoso API journeys |
| Auth | `X-Shopify-Storefront-Access-Token` | `X-Shopify-Access-Token` (shpca_/shpat_) |
| Token type | Public (safe in client code) | Private (server-side / test runner only) |
| Rate limit model | Time-bucket, lenient | Point-based, visible in `throttleStatus` field of every response |
| Bypasses Cloudflare bot gate? | Yes (authenticated) | Yes (authenticated) |

This split matters when discussing rate-limiting and 503s with prospects — see "Demo hooks" below.

### 5. The OAuth helper exists because Shopify retired the easy path

Shopify disabled the legacy "Settings → Apps → Develop apps" flow for new creations on 2026-01-01. The modern Partner-dashboard "Custom distribution" install link triggers **managed installation**, which installs the app server-side and redirects to the App URL with `hmac`/`host` params — never hitting your Redirect URL, so there's no OAuth `code` to exchange.

`scripts/get-token.js` works around this by calling `/admin/oauth/authorize` directly, which still runs the classic OAuth code-exchange flow. The Partner-dashboard install link is unused.

Full prospect-facing walkthrough: [`docs/get-token.md`](./get-token.md).

### 6. Product media is sourced from a separate GitHub repo

Shopify's `productCreateMedia` mutation needs a publicly accessible URL. The demo pulls images from [`github.com/andyAtSpotQA/filesForDemos`](https://github.com/andyAtSpotQA/filesForDemos/tree/main/product-images), organised by design (`comet_integration`, `border_not_found`, etc.) with mug/t-shirt/tote/sticker/pin variants.

Raw URL pattern:
```
https://raw.githubusercontent.com/andyAtSpotQA/filesForDemos/main/product-images/{design}/{item}.png
```

Keeps demo assets out of the storefront repo and gives a stable URL for Virtuoso `imageUrl` test data.

---

## What you can test with Virtuoso

### UI surface

Browse → product detail → add to cart → cart → checkout flow, all with stable testids. The checkout is fake but the journey is real (Virtuoso can assert on confirmation message, cart count returning to 0, etc.).

### API surface (full product lifecycle)

1. **Create** product (Admin API) → extract `productId`, `variantId`, `productHandle`
2. **Add image** (Admin API, public URL from GitHub repo)
3. **Publish** to Headless sales channel
4. **Set price**
5. **UI verify** — browse storefront, assert product appears with correct price/image
6. **Update price**
7. **UI verify** — refresh storefront, assert new price
8. **Delete** product (cleanup)

All eight steps confirmed working against `virtuosoqa-demo.myshopify.com`.

### Demo hooks (talking points for prospects)

- **Rate limiting story** — every Admin API response includes a `throttleStatus` field showing the point bucket. Virtuoso can assert on `throttleStatus.currentlyAvailable` dropping across calls, or deliberately exhaust it to demonstrate handling.
- **Cloudflare bot detection story** — Shopify sits behind Cloudflare. Anonymous browser navigation gets gated; authenticated API calls don't. Useful framing when a customer reports 503s during automation — the answer depends entirely on which side of the auth boundary the failing calls are on.

---

## What was deliberately not built

These have been considered and rejected as out-of-scope unless someone asks:

- **Real payment / Shopify hosted checkout** — would need Cart API + checkout redirect. Doable but a real scope increase.
- **Customer auth, accounts, wishlists, search, reviews** — not needed to exercise Virtuoso.
- **SSR / ISR / edge functions** — the whole point is a simple SPA target.
- **Tests, linting, formatting** — explicitly skipped per `CLAUDE.md`. Add only if asked.
- **CI / deployment pipeline** — runs locally, served to Virtuoso Bridge via `.local` hostname.

The discipline is the point. It's a **test target**, not a reference store.

---

## Key files

| File | Role |
|---|---|
| `src/api.ts` | GraphQL client + types. Single source of truth for what the storefront reads. |
| `src/cart.ts` | localStorage cart with pub/sub. No React deps. |
| `src/App.tsx` | Routes (react-router-dom v6) under a single `Layout`. |
| `src/components/Layout.tsx` | Header + footer + outlet. Holds the cart count. |
| `src/pages/*` | Home / Product / Cart pages. Fetch in `useEffect`, mutate cart directly. |
| `scripts/get-token.js` | One-shot OAuth helper for minting Admin API tokens. |
| `docs/get-token.md` | Prospect-facing walkthrough for the OAuth helper. |
| `CLAUDE.md` | AI-collaborator instructions; also useful as terse human-readable project guidance. |
| `.env` / `.env.example` | Both Admin API credentials (server-side) and Storefront credentials (`VITE_*`, exposed to browser). |

---

## Environment variables

Server-side (used by `scripts/get-token.js`):

- `SHOPIFY_API_KEY` — Client ID from Partner-dashboard app credentials
- `SHOPIFY_API_SECRET` — Client secret
- `SHOPIFY_SCOPES` — Comma-separated scopes to request (default: `read_products`)
- `SHOPIFY_SHOP` — Optional default shop domain
- `PORT` — Callback server port (default 4000)

Browser-side (used by `src/api.ts`, exposed to the client because they're prefixed `VITE_`):

- `VITE_SHOPIFY_STORE` — Store domain (e.g. `virtuosoqa-demo.myshopify.com`)
- `VITE_STOREFRONT_TOKEN` — Storefront API access token (public; safe to ship)

Omit the `VITE_*` pair to fall back to `mock.shop` (no auth, demo data).
