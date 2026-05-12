# shopify-virtuoso-demo

A deliberately minimal Vite + React + TypeScript storefront, built as a **test target for [Virtuoso](https://virtuoso.qa)** (AI-driven UI + API automation). Not a production e-commerce app — every decision is in service of being a stable, predictable target for automated tests running against real Shopify infrastructure.

## What you get

- A **React storefront** (`http://localhost:5173`) that browses products, manages a cart, and runs a fake "checkout" — all wired with stable `data-testid` selectors for Virtuoso journeys.
- A **Shopify Admin API OAuth helper** (`scripts/get-token.js`) that mints `shpca_` tokens for the second half of the demo: Virtuoso exercising the Admin API to create / update / delete products on a real store.
- Storefront data from either **`mock.shop`** (default, no auth) or a **real Shopify store** (set the `VITE_*` env vars).
- A working end-to-end flow: Virtuoso API steps create a product, set a price, upload an image; Virtuoso UI steps then assert the product appears correctly in the storefront.

## Quick start

```bash
npm install
npm run dev       # storefront on http://localhost:5173
```

That's it for the UI half. The app will read products from `mock.shop` out of the box — no token, no `.env`, no Shopify account needed.

## Connecting to a real Shopify store

Copy `.env.example` to `.env` and fill in:

```
VITE_SHOPIFY_STORE=your-store.myshopify.com
VITE_STOREFRONT_TOKEN=your_public_storefront_access_token
```

The storefront now reads from your real store via the Storefront API. Get the public storefront token from Shopify's **Headless** sales channel in your store admin (Apps → Headless → Create storefront).

## Getting an Admin API token (for API testing in Virtuoso)

```bash
npm run token -- your-store.myshopify.com
```

The script prints an OAuth authorize URL — open it in a browser logged into your store admin, click **Install app**, and the token is printed to your terminal.

Full walkthrough (including Partner-dashboard app setup): [`docs/get-token.md`](./docs/get-token.md).

## Docs

- [`docs/architecture.md`](./docs/architecture.md) — topology, key decisions, what was deliberately not built.
- [`docs/get-token.md`](./docs/get-token.md) — how to mint a Shopify Admin API token via OAuth (prospect-facing walkthrough).
- [`docs/virtuoso-journey.md`](./docs/virtuoso-journey.md) — full Virtuoso journey blueprint: 8 API + UI steps with battle-tested request bodies, helper extensions, and operational notes.

## Architecture overview

For the full picture — topology, key decisions, what was deliberately not built — see [`docs/architecture.md`](./docs/architecture.md).

The short version:

- `src/api.ts` — thin GraphQL client. Falls back to `mock.shop` if `VITE_*` env vars are absent.
- `src/cart.ts` — localStorage cart with a tiny pub/sub. Client-only, no backend.
- `src/pages/*` — Home / Product / Cart pages, fetch in `useEffect`, mutate cart directly.
- `scripts/get-token.js` — one-shot OAuth helper for the Admin API.

## The Virtuoso testid contract

These attributes are the stable selectors Virtuoso journeys are written against. **Preserve them when editing**:

| Attribute | Where | Used for |
|---|---|---|
| `data-testid="product-card"` | Home page tiles | Pick a product |
| `data-testid="add-to-cart"` | Product detail button | Add to cart |
| `data-testid="cart-line"` | Each row in cart | Assert items |
| `data-testid="cart-subtotal"` | Cart total | Assert price total |
| `data-testid="checkout"` | Cart page button | Complete journey |
| `data-testid="nav-cart"` | Header link | Navigate to cart |
| `data-testid="cart-count"` | Header badge | Assert cart size |
| `data-handle` | Product card + detail | Address specific products |
| `data-variant-id` | Cart line | Address specific variants |

## Commands

```bash
npm install          # install deps
npm run dev          # start Vite dev server
npm run build        # tsc -b && vite build (emits dist/)
npm run preview      # serve the built bundle
npm run token        # OAuth helper (prompts for shop domain)
npx tsc -b           # type-check only
```

No test suite, linter, or formatter is configured — intentionally. Add only if asked.

## Demo deliverables

`scripts/get-token.js` and `docs/get-token.md` are **prospect-facing** demo deliverables, not throwaway helpers. They show prospects how to obtain an Admin API token now that Shopify retired the "legacy custom app" flow (disabled for new creations 2026-01-01). Keep them accurate — drift will break demos.

## What this is *not*

- Not a reference Shopify implementation. Don't add wishlist / auth / search / payment / SSR without scoping the change.
- Not a production app. "Checkout" clears the cart and shows a confirmation. There is no payment integration and no server.
- Not opinionated on testing tools. The `data-testid` attributes are generic — any browser-automation framework can hit them; Virtuoso is just the original audience.
