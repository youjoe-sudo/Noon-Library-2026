import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';
import type { CartItem } from './types';
import { useToast } from './toast';

interface CartContextValue {
  items: CartItem[];
  loading: boolean;
  count: number;
  addToCart: (bookId: string, quantity?: number) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const { show } = useToast();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCart = useCallback(async () => {
    if (!session?.user) {
      setItems([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('cart_items')
      .select('*, book:books(*)')
      .eq('user_id', session.user.id);
    if (error) {
      setItems([]);
      setLoading(false);
      return;
    }
    setItems((data as CartItem[]) ?? []);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    setLoading(true);
    fetchCart();
  }, [fetchCart]);

  const addToCart = useCallback(async (bookId: string, quantity = 1) => {
    if (!session?.user) {
      show('يرجى تسجيل الدخول لإضافة الكتب إلى السلة', 'info');
      return;
    }
    const existing = items.find((i) => i.book_id === bookId);
    if (existing) {
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity: existing.quantity + quantity })
        .eq('id', existing.id);
      if (error) {
        show('فشل تحديث السلة', 'error');
        return;
      }
    } else {
      const { error } = await supabase
        .from('cart_items')
        .insert({ user_id: session.user.id, book_id: bookId, quantity });
      if (error) {
        show('فشل إضافة الكتاب إلى السلة', 'error');
        return;
      }
    }
    show('تمت الإضافة إلى السلة', 'success');
    await fetchCart();
  }, [session, items, fetchCart, show]);

  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    if (quantity < 1) return;
    const { error } = await supabase.from('cart_items').update({ quantity }).eq('id', itemId);
    if (error) {
      show('فشل تحديث الكمية', 'error');
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, quantity } : i)));
  }, [show]);

  const removeItem = useCallback(async (itemId: string) => {
    const { error } = await supabase.from('cart_items').delete().eq('id', itemId);
    if (error) {
      show('فشل حذف الكتاب', 'error');
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    show('تم حذف الكتاب من السلة', 'success');
  }, [show]);

  const clearCart = useCallback(async () => {
    if (!session?.user) return;
    const { error } = await supabase.from('cart_items').delete().eq('user_id', session.user.id);
    if (error) return;
    setItems([]);
  }, [session]);

  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, loading, count, addToCart, updateQuantity, removeItem, clearCart, refresh: fetchCart }}>
      {children}
    </CartContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

// eslint-disable-next-line react-refresh/only-export-components
export function getCartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    if (!item.book) return sum;
    const price = item.book.discount_price != null && item.book.discount_price < item.book.price
      ? item.book.discount_price : item.book.price;
    return sum + price * item.quantity;
  }, 0);
}

// eslint-disable-next-line react-refresh/only-export-components
export function getCartBookCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}
