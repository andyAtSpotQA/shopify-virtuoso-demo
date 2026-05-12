// Thin GraphQL client for the Shopify Storefront API.
// Set VITE_SHOPIFY_STORE and VITE_STOREFRONT_TOKEN in .env to use a real store;
// omit them to fall back to mock.shop (no auth, returns real-shaped data).

const STORE = import.meta.env.VITE_SHOPIFY_STORE as string | undefined;
const STOREFRONT_TOKEN = import.meta.env.VITE_STOREFRONT_TOKEN as string | undefined;
const ENDPOINT = STORE
  ? `https://${STORE}/api/2025-01/graphql.json`
  : 'https://mock.shop/api';

export type Money = { amount: string; currencyCode: string };

export type ProductImage = { url: string; altText: string | null };

export type ProductVariant = {
  id: string;
  title: string;
  price: Money;
  availableForSale: boolean;
};

export type ProductSummary = {
  id: string;
  handle: string;
  title: string;
  description: string;
  featuredImage: ProductImage | null;
  priceRange: { minVariantPrice: Money };
};

export type Product = ProductSummary & {
  images: { edges: { node: ProductImage }[] };
  variants: { edges: { node: ProductVariant }[] };
};

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const url = ENDPOINT + '?t=' + Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(STOREFRONT_TOKEN && { 'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN }),
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Storefront API error ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data as T;
}

const PRODUCT_SUMMARY_FIELDS = `
  id
  handle
  title
  description
  featuredImage { url altText }
  priceRange { minVariantPrice { amount currencyCode } }
`;

export async function fetchProducts(first = 24): Promise<ProductSummary[]> {
  const data = await gql<{ products: { edges: { node: ProductSummary }[] } }>(
    `query Products($first: Int!) {
      products(first: $first) {
        edges { node { ${PRODUCT_SUMMARY_FIELDS} } }
      }
    }`,
    { first },
  );
  return data.products.edges.map((e) => e.node);
}

export async function fetchProductByHandle(handle: string): Promise<Product | null> {
  const data = await gql<{ product: Product | null }>(
    `query Product($handle: String!) {
      product(handle: $handle) {
        ${PRODUCT_SUMMARY_FIELDS}
        images(first: 5) { edges { node { url altText } } }
        variants(first: 10) {
          edges {
            node {
              id
              title
              availableForSale
              price { amount currencyCode }
            }
          }
        }
      }
    }`,
    { handle },
  );
  return data.product;
}

export function formatMoney(m: Money): string {
  const n = Number(m.amount);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: m.currencyCode,
  }).format(n);
}
