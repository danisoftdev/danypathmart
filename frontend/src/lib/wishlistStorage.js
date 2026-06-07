import api from './api';

const WISHLIST_KEY = 'dpm_wishlist';
const EVENT = 'dpm:wishlist-changed';

function emit() {
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function getWishlistIdsLocal() {
  try {
    const raw = localStorage.getItem(WISHLIST_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.map(Number).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function setWishlistIdsLocal(ids) {
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(ids));
  emit();
}

export function isWishlistedLocal(productId) {
  return getWishlistIdsLocal().includes(Number(productId));
}

export function toggleWishlistLocal(productId) {
  const id = Number(productId);
  const ids = getWishlistIdsLocal();
  const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  setWishlistIdsLocal(next);
  return next.includes(id);
}

/** Merge guest wishlist into the account after login. */
export async function syncWishlistToServer() {
  const local = getWishlistIdsLocal();
  if (!local.length) return;
  try {
    await api.post('/wishlist/sync', { product_ids: local });
    localStorage.removeItem(WISHLIST_KEY);
    emit();
  } catch {
    /* keep local copy if sync fails */
  }
}

export async function fetchWishlistIds() {
  const { data } = await api.get('/wishlist');
  return data.ids ?? [];
}

export async function toggleWishlistApi(productId) {
  const { data } = await api.post('/wishlist/toggle', { product_id: Number(productId) });
  emit();
  return !!data.wishlisted;
}

export function onWishlistChange(handler) {
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

/** @deprecated use hooks/wishlist */
export function getWishlistIds() {
  return getWishlistIdsLocal();
}

export function isWishlisted(productId) {
  return isWishlistedLocal(productId);
}

export function toggleWishlist(productId) {
  return toggleWishlistLocal(productId);
}
