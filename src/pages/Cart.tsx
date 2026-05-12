import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cart, type CartLine } from '../cart';
import { formatMoney } from '../api';

export default function Cart() {
  const [lines, setLines] = useState<CartLine[]>(cart.get());
  const [placed, setPlaced] = useState(false);

  useEffect(() => cart.subscribe(() => setLines(cart.get())), []);

  const currency = lines[0]?.price.currencyCode ?? 'USD';
  const subtotal = cart.subtotal();

  if (placed) {
    return (
      <section data-testid="order-confirmation">
        <h1>Thanks!</h1>
        <p>Your mock order has been placed. (No payment processed.)</p>
        <Link to="/" className="primary button-link">Continue shopping</Link>
      </section>
    );
  }

  if (lines.length === 0) {
    return (
      <section data-testid="cart-empty">
        <h1>Your cart is empty</h1>
        <Link to="/" className="primary button-link">Browse products</Link>
      </section>
    );
  }

  return (
    <section data-testid="cart">
      <h1>Cart</h1>
      <ul className="cart-list">
        {lines.map((line) => (
          <li key={line.variantId} className="cart-line" data-testid="cart-line" data-variant-id={line.variantId}>
            {line.imageUrl && <img src={line.imageUrl} alt={line.title} />}
            <div className="cart-line-info">
              <strong>{line.title}</strong>
              <span>{line.variantTitle}</span>
              <span>{formatMoney(line.price)}</span>
            </div>
            <div className="cart-line-controls">
              <input
                data-testid="line-quantity"
                type="number"
                min={1}
                value={line.quantity}
                onChange={(e) => cart.setQuantity(line.variantId, Math.max(1, Number(e.target.value) || 1))}
              />
              <button
                data-testid="line-remove"
                onClick={() => cart.remove(line.variantId)}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="cart-summary">
        <span>Subtotal</span>
        <strong data-testid="cart-subtotal">
          {formatMoney({ amount: subtotal.toFixed(2), currencyCode: currency })}
        </strong>
      </div>

      <button
        data-testid="checkout"
        className="primary"
        onClick={() => {
          cart.clear();
          setPlaced(true);
        }}
      >
        Checkout
      </button>
    </section>
  );
}
