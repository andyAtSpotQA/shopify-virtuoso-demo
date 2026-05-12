import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchProductByHandle, formatMoney, type Product } from '../api';
import { cart } from '../cart';

export default function ProductDetail() {
  const { handle } = useParams<{ handle: string }>();
  const nav = useNavigate();
  const [product, setProduct] = useState<Product | null | undefined>(undefined);
  const [variantId, setVariantId] = useState<string>('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!handle) return;
    fetchProductByHandle(handle).then((p) => {
      setProduct(p);
      const firstAvailable = p?.variants.edges.find((e) => e.node.availableForSale);
      if (firstAvailable) setVariantId(firstAvailable.node.id);
    });
  }, [handle]);

  if (product === undefined) return <p data-testid="loading">Loading…</p>;
  if (product === null) return <p data-testid="not-found">Product not found.</p>;

  const variants = product.variants.edges.map((e) => e.node);
  const variant = variants.find((v) => v.id === variantId) ?? variants[0];

  function addToCart() {
    if (!product || !variant) return;
    cart.add({
      variantId: variant.id,
      productHandle: product.handle,
      title: product.title,
      variantTitle: variant.title,
      imageUrl: product.featuredImage?.url ?? null,
      price: variant.price,
    }, quantity);
    nav('/cart');
  }

  return (
    <article className="product-detail" data-testid="product-detail" data-handle={product.handle}>
      <div className="gallery">
        {product.images.edges.map(({ node }, i) => (
          <img key={i} src={node.url} alt={node.altText ?? product.title} />
        ))}
      </div>
      <div className="info">
        <h1>{product.title}</h1>
        <p className="price" data-testid="product-price">{formatMoney(variant.price)}</p>
        <p className="description">{product.description}</p>

        {variants.length > 1 && (
          <label className="field">
            <span>Variant</span>
            <select
              data-testid="variant-select"
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
            >
              {variants.map((v) => (
                <option key={v.id} value={v.id} disabled={!v.availableForSale}>
                  {v.title} — {formatMoney(v.price)}
                  {v.availableForSale ? '' : ' (sold out)'}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="field">
          <span>Quantity</span>
          <input
            data-testid="quantity-input"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>

        <button
          data-testid="add-to-cart"
          className="primary"
          disabled={!variant?.availableForSale}
          onClick={addToCart}
        >
          {variant?.availableForSale ? 'Add to cart' : 'Sold out'}
        </button>
      </div>
    </article>
  );
}
