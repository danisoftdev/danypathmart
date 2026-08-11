import { create } from 'zustand';

let hideTimer = null;

export const useToastStore = create((set) => ({
  message: '',
  visible: false,
  show(message) {
    if (!message) return;
    if (hideTimer) clearTimeout(hideTimer);
    set({ message, visible: true });
    hideTimer = setTimeout(() => {
      set({ visible: false });
      hideTimer = null;
    }, 2800);
  },
  hide() {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = null;
    set({ visible: false });
  },
}));

export function showCartAddedToast(productName) {
  const label = productName ? `Added to cart · ${productName}` : 'Added to cart';
  useToastStore.getState().show(label);
}
