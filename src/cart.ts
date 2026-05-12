// Simple localStorage-backed cart with a tiny pub/sub so components re-render on change.

import type { Money } from './api';

export type CartLine = {
  variantId: string;
  productHandle: string;
  title: string;
  variantTitle: string;
  imageUrl: string | null;
  price: Money;
  quantity: number;
};

const KEY = 'virtuoso-demo-cart';
const listeners = new Set<() => void>();

function read(): CartLine[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CartLine[]) : [];
  } catch {
    return [];
  }
}

function write(lines: CartLine[]) {
  localStorage.setItem(KEY, JSON.stringify(lines));
  listeners.forEach((fn) => fn());
}

export const cart = {
  get(): CartLine[] {
    return read();
  },
  add(line: Omit<CartLine, 'quantity'>, quantity = 1) {
    const lines = read();
    const existing = lines.find((l) => l.variantId === line.variantId);
    if (existing) existing.quantity += quantity;
    else lines.push({ ...line, quantity });
    write(lines);
  },
  setQuantity(variantId: string, quantity: number) {
    const lines = read()
      .map((l) => (l.variantId === variantId ? { ...l, quantity } : l))
      .filter((l) => l.quantity > 0);
    write(lines);
  },
  remove(variantId: string) {
    write(read().filter((l) => l.variantId !== variantId));
  },
  clear() {
    write([]);
  },
  count(): number {
    return read().reduce((n, l) => n + l.quantity, 0);
  },
  subtotal(): number {
    return read().reduce((n, l) => n + Number(l.price.amount) * l.quantity, 0);
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
