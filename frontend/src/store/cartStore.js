import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { showCartAddedToast } from './toastStore';

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],

      addItem(product, qty = 1) {
        // Marketplace shop items are bought on /stores/{slug}, never the main DPM cart.
        const shopId = product?.shop_id ?? product?.shop?.id;
        if (shopId != null && Number(shopId) > 0) {
          return false;
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
            is_preorder: !!product.is_preorder,
            shop_id: null,
            shop_name: null,
            requires_custom_proof: !!product.requires_custom_proof,
            custom_proof: product.custom_proof || null,
            qty,
          });
        }
        set({ items });
        showCartAddedToast(product.name);
        return true;
      },

      addItems(products = []) {
        if (!Array.isArray(products) || products.length === 0) return;
        for (const product of products) {
          const qty = Math.max(1, Number(product.qty) || 1);
          get().addItem(product, qty);
        }
      },

      /** Drop any legacy shop lines that should not live in the main cart. */
      purgeShopItems() {
        const next = get().items.filter((i) => !(i.shop_id != null && Number(i.shop_id) > 0));
        if (next.length !== get().items.length) {
          set({ items: next });
        }
      },

      removeItem(id) {
        set({ items: get().items.filter((i) => i.id !== id) });
      },

      updateQty(id, qty) {
        const next = Math.max(1, Number(qty) || 1);
        set({ items: get().items.map((i) => (i.id === id ? { ...i, qty: next } : i)) });
      },

      updateCustomProof(id, custom_proof) {
        set({
          items: get().items.map((i) => (i.id === id ? { ...i, custom_proof } : i)),
        });
      },

      clearCart() {
        set({ items: [] });
      },

      totalItems() {
        return get().items.reduce((sum, i) => sum + i.qty, 0);
      },

      subtotal() {
        return get().items.reduce((sum, i) => sum + i.price * i.qty, 0);
      },
    }),
    { name: 'dpm-cart' }
  )
);
