import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchProducts, formatMoney, type ProductSummary } from '../api';

export default function Home() {
  const [products, setProducts] = useState<ProductSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts(24)
      .then(setProducts)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <p data-testid="error">Error: {error}</p>;
  if (!products) return <p data-testid="loading">Loading products…</p>;

  return (
    <section>
      <h1>Products</h1>
      <ul className="grid" data-testid="product-grid">
        {products.map((p) => (
          <li key={p.id} className="card" data-testid="product-card" data-handle={p.handle}>
            <Link to={`/products/${p.handle}`}>
              {p.featuredImage && (
                <img src={p.featuredImage.url} alt={p.featuredImage.altText ?? p.title} />
              )}
              <h3>{p.title}</h3>
              <p className="price">{formatMoney(p.priceRange.minVariantPrice)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
