import { create } from 'zustand';
import { persist } from 'zustand/middleware';

let lineSeq = 1;

export const useGroupOrderStore = create(
  persist(
    (set, get) => ({
      organizationName: '',
      lines: [],

      setOrganizationName(name) {
        set({ organizationName: String(name || '') });
      },

      addLine(product, recipientName = '', sizeLabel = '') {
        const lines = [
          ...get().lines,
          {
            key: `line-${lineSeq++}`,
            product_id: product.id,
            name: product.name,
            price: Number(product.price) || 0,
            image: Array.isArray(product.images) ? product.images[0] : product.image,
            is_preorder: !!product.is_preorder,
            quantity: 1,
            recipient_name: recipientName.trim(),
            size_label: sizeLabel.trim(),
          },
        ];
        set({ lines });
      },

      updateLine(key, patch) {
        set({
          lines: get().lines.map((line) => (line.key === key ? { ...line, ...patch } : line)),
        });
      },

      removeLine(key) {
        set({ lines: get().lines.filter((line) => line.key !== key) });
      },

      clear() {
        set({ organizationName: '', lines: [] });
      },

      shippingItems() {
        return get().lines.map((line) => ({
          product_id: line.product_id,
          quantity: line.quantity,
          recipient_name: line.recipient_name,
          size_label: line.size_label,
        }));
      },

      subtotal() {
        return get().lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
      },
    }),
    { name: 'dpm-group-order' }
  )
);
