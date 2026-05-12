# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

A deliberately minimal Vite + React + TypeScript storefront used as a test target for **Virtuoso** (AI test-automation). The goal is to give Virtuoso a real browser app with real XHR traffic to exercise — not to be a production Shopify app.

## Commands

```bash
npm install          # install deps
npm run dev          # start Vite dev server on http://localhost:5173
npm run build        # tsc -b && vite build (emits dist/)
npm run preview      # serve the built bundle
npm run token        # OAuth helper: mint a shpat_ Admin API token for a store
npx tsc -b           # type-check only, no emit
```

There is no test suite, linter, or formatter configured — intentionally. Add them only if asked.

## Architecture

**Data source: `mock.shop`** (`src/api.ts`).
`https://mock.shop/api` is Shopify's public, auth-free mock Storefront API. It returns real-shaped Shopify GraphQL responses. No tokens, no `.env`, no store setup. If a future task needs a real Shopify store, swap `ENDPOINT` and add a `X-Shopify-Storefront-Access-Token` header — the GraphQL shape stays the same.

**Data flow:**
- `src/api.ts` — GraphQL client (`gql<T>()`) + `fetchProducts` / `fetchProductByHandle` + `formatMoney`. All types live here.
- `src/cart.ts` — localStorage-backed cart with a tiny pub/sub (`cart.subscribe`). Components call `cart.get()` once and re-read on subscription events. No React context, no Redux.
- `src/pages/*` — route components fetch in `useEffect` and render; they import `cart` directly to mutate state.
- `src/App.tsx` — `react-router-dom` v6 routes nested under a single `Layout`.

**Testing hooks for Virtuoso:** every interactive or assertion-worthy element has a `data-testid` (e.g. `product-card`, `add-to-cart`, `cart-line`, `cart-subtotal`, `checkout`). Product cards and detail pages also expose `data-handle`; cart lines expose `data-variant-id`. **Preserve these attributes** when editing — Virtuoso journeys will be written against them.

## Admin API token helper (`scripts/get-token.js`)

One-shot OAuth helper that mints a long-lived `shpat_...` Admin API access token for a Shopify store, **without** the retired "legacy custom app" flow (disabled for new creations 2026-01-01). It's the second half of the demo: first Virtuoso exercises the UI against this app, then Virtuoso exercises the Admin API using a token obtained via this script.

- Reads `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` from `.env` (values come from a Partner-dashboard custom app's Credentials page).
- Listens on `http://localhost:4000/callback` (configurable via `PORT`), catches the OAuth `code`, exchanges it for a token, prints it, exits.
- Full walkthrough in `docs/get-token.md` — that doc is **prospect-facing** and is part of the sales-demo deliverable. Keep it accurate and replicable; drift will break demos.

When editing either the script or the doc, treat them as a pair — changes to one often require changes to the other (e.g. port numbers, env var names, Redirect URL shape).

## Conventions

- GraphQL queries are inline template strings in `src/api.ts`. Share fragments via the `PRODUCT_SUMMARY_FIELDS` constant — don't introduce a GraphQL codegen pipeline unless asked.
- The cart is intentionally client-only. "Checkout" clears the cart and shows a confirmation — there is no payment integration and no server. Don't add one without discussing scope.
- Keep the surface area small. This is a test target, not a reference implementation; avoid adding features (wishlist, auth, search) unless they're needed to exercise a specific Virtuoso scenario.
