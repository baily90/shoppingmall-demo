import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { listCart } from '../api/trade';
import { useAuth } from './auth';

interface CartCountContextValue {
  /** 购物车商品总件数（用于 TabBar 角标） */
  count: number;
  refresh: () => void;
}

const CartCountContext = createContext<CartCountContextValue | null>(null);

export function CartCountProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    listCart()
      .then((res) => setCount(res.data.data.reduce((s, i) => s + i.quantity, 0)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user) refresh();
    else setCount(0);
  }, [user, refresh]);

  const value = useMemo(() => ({ count, refresh }), [count, refresh]);
  return <CartCountContext.Provider value={value}>{children}</CartCountContext.Provider>;
}

export function useCartCount(): CartCountContextValue {
  const ctx = useContext(CartCountContext);
  if (!ctx) {
    throw new Error('useCartCount must be used within CartCountProvider');
  }
  return ctx;
}
