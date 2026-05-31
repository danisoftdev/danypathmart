import { create } from 'zustand';

/**
 * Holds the most recent image-search result so the /search page can render it
 * after navigation. Intentionally not persisted (ephemeral, in-memory only).
 */
export const useImageSearchStore = create((set) => ({
  result: null, // { found, labels, products, alert_id, previewUrl }
  setResult(result) {
    set({ result });
  },
  clear() {
    set({ result: null });
  },
}));
