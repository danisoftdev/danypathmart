const RECENT_SEARCHES_KEY = 'dpm_recent_searches';
const RECENTLY_VIEWED_KEY = 'dpm_recently_viewed';
const MAX_SEARCHES = 8;
const MAX_VIEWED = 12;

export const DEFAULT_POPULAR_SEARCHES = [
  'pathfinder uniform',
  'badges',
  'scarf',
  'adventurer',
  'class pins',
  'manual',
];

export function getRecentSearches() {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((s) => typeof s === 'string' && s.trim()) : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(term) {
  const q = String(term || '').trim();
  if (!q) return;
  const prev = getRecentSearches().filter((s) => s.toLowerCase() !== q.toLowerCase());
  const next = [q, ...prev].slice(0, MAX_SEARCHES);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
}

export function clearRecentSearches() {
  localStorage.removeItem(RECENT_SEARCHES_KEY);
}

export function getRecentlyViewed() {
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** @param {{ id: number, slug: string, name: string, price: number, images?: string[] }} product */
export function addRecentlyViewed(product) {
  if (!product?.id || !product?.slug) return;
  const entry = {
    id: product.id,
    slug: product.slug,
    name: product.name,
    price: product.price,
    images: product.images ?? [],
  };
  const prev = getRecentlyViewed().filter((p) => p.id !== entry.id);
  const next = [entry, ...prev].slice(0, MAX_VIEWED);
  localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
}
