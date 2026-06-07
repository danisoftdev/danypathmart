const KEY = 'dpm_saved_for_later';

export function getSavedForLater() {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function addSavedForLater(item) {
  const list = getSavedForLater().filter((i) => i.id !== item.id);
  list.push({
    id: item.id,
    name: item.name,
    price: item.price,
    image: item.image,
    is_preorder: !!item.is_preorder,
    qty: item.qty || 1,
  });
  localStorage.setItem(KEY, JSON.stringify(list));
  return list;
}

export function removeSavedForLater(id) {
  const next = getSavedForLater().filter((i) => i.id !== id);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
