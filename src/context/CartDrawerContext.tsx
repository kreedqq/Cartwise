import * as React from "react";

export interface CartDrawerItem {
  productName: string;
  cartId: string;
  /** Quantity that was just added. */
  quantity?: number;
  /** Effective unit price in USD (with role markup) — from unit_price_usd_snapshot. */
  unitPriceUsd?: number | null;
  /** Variant label, e.g. "5 mg" — for context in the drawer. */
  variantLabel?: string | null;
}

interface CartDrawerContextValue {
  item: CartDrawerItem | null;
  isOpen: boolean;
  openDrawer: (item: CartDrawerItem) => void;
  closeDrawer: () => void;
}

const CartDrawerContext = React.createContext<CartDrawerContextValue>({
  item: null,
  isOpen: false,
  openDrawer: () => undefined,
  closeDrawer: () => undefined,
});

/** Auto-close the drawer after this many milliseconds. */
const AUTO_CLOSE_MS = 4_000;
/** Keep item data alive while the slide-out animation plays (matches --motion-slow). */
const CLEAR_ITEM_AFTER_MS = 350;

export function CartDrawerProvider({ children }: { children: React.ReactNode }) {
  const [item, setItem] = React.useState<CartDrawerItem | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const autoCloseRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearItemRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const openDrawer = React.useCallback((next: CartDrawerItem) => {
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    if (clearItemRef.current) clearTimeout(clearItemRef.current);
    setItem(next);
    setIsOpen(true);
    autoCloseRef.current = setTimeout(() => setIsOpen(false), AUTO_CLOSE_MS);
  }, []);

  const closeDrawer = React.useCallback(() => {
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    if (clearItemRef.current) clearTimeout(clearItemRef.current);
    setIsOpen(false);
    // Clear item after animation so CartDrawer content stays visible during slide-out
    clearItemRef.current = setTimeout(() => setItem(null), CLEAR_ITEM_AFTER_MS);
  }, []);

  return (
    <CartDrawerContext value={{ item, isOpen, openDrawer, closeDrawer }}>
      {children}
    </CartDrawerContext>
  );
}

export function useCartDrawer() {
  return React.useContext(CartDrawerContext);
}
