import { useShopOrders } from '../../hooks/shop';
import { formatPrice } from '../../lib/currency';
import { AdminTableSkeleton } from '../../components/ui/Skeleton';

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function ShopOrdersPage() {
  const { data: orders = [], isLoading } = useShopOrders();

  return (
    <div>
      <h1 className="text-xl font-extrabold md:text-2xl">Orders</h1>
      <p className="mt-1 text-sm text-muted">Orders that include at least one of your products.</p>

      {isLoading ? (
        <div className="mt-6"><AdminTableSkeleton rows={5} cols={5} /></div>
      ) : orders.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No orders yet.</p>
      ) : (
        <div className="mt-6 admin-panel overflow-x-auto">
          <table className="admin-table w-full min-w-[560px] text-sm">
            <thead>
              <tr>
                <th>Order</th>
                <th>Your subtotal</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="font-semibold">#{o.id}</td>
                  <td>{formatPrice(o.shop_subtotal)}</td>
                  <td className="uppercase text-xs">{o.payment_status}</td>
                  <td>{o.status}</td>
                  <td className="text-xs text-muted">{formatWhen(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
