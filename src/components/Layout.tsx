import { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { cart } from '../cart';

export default function Layout() {
  const [count, setCount] = useState(cart.count());
  useEffect(() => cart.subscribe(() => setCount(cart.count())), []);

  return (
    <div className="app">
      <header className="header">
        <Link to="/" className="brand" data-testid="nav-home">
          Virtuoso Demo Shop
        </Link>
        <nav>
          <Link to="/cart" data-testid="nav-cart" className="cart-link">
            Cart <span className="cart-count" data-testid="cart-count">{count}</span>
          </Link>
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
      <footer className="footer">Powered by Shopify</footer>
    </div>
  );
}
