import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],

      addItem(product, qty = 1) {
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
            shop_id: product.shop_id ?? null,
            shop_name: product.shop_name ?? product.shop?.name ?? null,
            requires_custom_proof: !!product.requires_custom_proof,
            custom_proof: product.custom_proof || null,
            qty,
          });
        }
        set({ items });
      },

      addItems(products = []) {
        if (!Array.isArray(products) || products.length === 0) return;
        const items = [...get().items];
        for (const product of products) {
          const qty = Math.max(1, Number(product.qty) || 1);
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
              shop_id: product.shop_id ?? null,
              shop_name: product.shop_name ?? product.shop?.name ?? null,
              requires_custom_proof: !!product.requires_custom_proof,
              custom_proof: product.custom_proof || null,
              qty,
            });
          }
        }
        set({ items });
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
