import api from './api';
import { useCartStore } from '../store/cartStore';

/** Fetch order detail and add its line items to the cart (UI-only convenience). */
export async function reorderOrder(orderId) {
  const { data } = await api.get(`/orders/${orderId}`);
  const items = data?.order?.items;
  if (!Array.isArray(items) || items.length === 0) return false;

  const addItem = useCartStore.getState().addItem;
  items.forEach((it) => {
    if (!it.product_id) return;
    addItem(
      {
        id: it.product_id,
        name: it.name,
        price: it.unit_price,
        image: it.image,
        is_preorder: it.is_preorder,
      },
      it.quantity
    );
  });
  return true;
}
