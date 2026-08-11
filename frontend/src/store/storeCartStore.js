import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { showCartAddedToast } from './toastStore';

/** Per-shop cart for storefront checkout (/stores/:slug). */
export const useStoreCartStore = create(
  persist(
    (set, get) => ({
      shopSlug: null,
      shopName: null,
      items: [],

      setShop(slug, name) {
        const current = get().shopSlug;
        if (current && current !== slug) {
          set({ shopSlug: slug, shopName: name, items: [] });
        } else {
          set({ shopSlug: slug, shopName: name });
        }
      },

      addItem(product, qty = 1, shopSlug, shopName) {
        const slug = shopSlug || product.shop_slug || product.shop?.slug;
        const name = shopName || product.shop_name || product.shop?.name;
        if (!slug) return;

        if (get().shopSlug && get().shopSlug !== slug) {
          set({ shopSlug: slug, shopName: name, items: [] });
        } else if (!get().shopSlug) {
          set({ shopSlug: slug, shopName: name });
        }

        const items = [...get().items];
        const existing = items.find((i) => i.id === product.id);
        if (existing) {
          existing.qty += qty;
        } else {
          items.push({
            id: product.id,
            name: product.name,
            price: Number(product.price) || 0,
            image: Array.isArray(product.images) ? product.images[0] : product.image,
            shop_id: product.shop_id ?? null,
            qty,
          });
        }
        set({ items });
        showCartAddedToast(product.name);
      },

      removeItem(id) {
        set({ items: get().items.filter((i) => i.id !== id) });
      },

      updateQty(id, qty) {
        const next = Math.max(1, Number(qty) || 1);
        set({ items: get().items.map((i) => (i.id === id ? { ...i, qty: next } : i)) });
      },

      clearCart() {
        set({ items: [], shopSlug: null, shopName: null });
      },

      totalItems() {
        return get().items.reduce((sum, i) => sum + i.qty, 0);
      },

      subtotal() {
        return get().items.reduce((sum, i) => sum + i.price * i.qty, 0);
      },
    }),
    { name: 'dpm-store-cart' }
  )
);
