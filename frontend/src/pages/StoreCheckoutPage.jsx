import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import api from '../lib/api';
import { useStoreCartStore } from '../store/storeCartStore';
import { formatPrice } from '../lib/currency';
import { useAuthStore } from '../store/authStore';
import { useAddresses } from '../hooks/checkout';
import { StorefrontLegalNotice } from '../components/legal/SellerPolicyLinks';

export default function StoreCheckoutPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { shop, paymentMethods = [] } = useOutletContext() ?? {};
  const items = useStoreCartStore((s) => s.items);
  const cartSlug = useStoreCartStore((s) => s.shopSlug);
  const subtotal = useStoreCartStore((s) => s.subtotal);
  const clearCart = useStoreCartStore((s) => s.clearCart);

  const { data: addrData, isLoading: addressesLoading } = useAddresses(!!user);
  const addresses = Array.isArray(addrData?.data) ? addrData.data : [];

  const [addressId, setAddressId] = useState('');
  const [fulfillmentMode, setFulfillmentMode] = useState('delivery');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [momoInfo, setMomoInfo] = useState(null);

  useEffect(() => {
    if (!paymentMethod && paymentMethods.length > 0) {
      setPaymentMethod(paymentMethods[0].id);
    }
  }, [paymentMethods, paymentMethod]);

  useEffect(() => {
    if (addressId || addresses.length === 0) return;
    const preferred = addresses.find((a) => a.is_default) ?? addresses[0];
    if (preferred?.id != null) setAddressId(String(preferred.id));
  }, [addresses, addressId]);

  const placeOrder = useMutation({
    mutationFn: async () => {
      const payload = {
        shop_slug: slug,
        items: items.map((i) => ({ product_id: i.id, quantity: i.qty })),
        payment_method: paymentMethod,
        shop_fulfillment_mode: fulfillmentMode,
        notes: notes.trim() || undefined,
      };
      if (fulfillmentMode === 'delivery' && addressId) {
        payload.address_id = Number(addressId);
      }
      return (await api.post('/storefront/orders', payload)).data;
    },
  });

  if (!user) {
    return <Navigate to="/login" replace state={{ from: `/stores/${slug}/checkout` }} />;
  }

  if (!items.length || cartSlug !== slug) {
    return <Navigate to={`/stores/${slug}/cart`} replace />;
  }

  const pickupAvailable = shop?.allows_shop_pickup && shop?.has_map_pin;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setMomoInfo(null);
    let createdOrderId = null;
    try {
      const result = await placeOrder.mutateAsync();
      createdOrderId = result.order_id;

      if (result.requires_online_payment) {
        try {
          const pay = await api.post('/payments/initialize', { order_id: result.order_id });
          const data = pay.data;
          if (data.authorization_url) {
            clearCart();
            window.location.href = data.authorization_url;
            return;
          }
          // Order exists but gateway did not return a pay URL — send buyer to complete payment.
          clearCart();
          navigate(`/order/${result.order_id}`, {
            replace: true,
            state: { paymentNotice: 'Order placed. Complete payment below to confirm it.' },
          });
          return;
        } catch (payErr) {
          clearCart();
          navigate(`/order/${result.order_id}`, {
            replace: true,
            state: {
              paymentNotice:
                payErr.response?.data?.message
                || 'Order placed, but online payment could not start. Use Complete payment below.',
            },
          });
          return;
        }
      }

      clearCart();
      if (result.payment_method === 'momo') {
        setMomoInfo({ orderId: result.order_id, momo: result.momo_number });
        return;
      }
      navigate(`/order/${result.order_id}`);
    } catch (err) {
      if (createdOrderId) {
        clearCart();
        navigate(`/order/${createdOrderId}`, {
          replace: true,
          state: { paymentNotice: 'Order placed. Check payment status below.' },
        });
        return;
      }
      setError(err.response?.data?.message || 'Could not place order.');
    }
  };

  if (momoInfo) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <h1 className="text-xl font-extrabold">Pay via MoMo</h1>
        <p className="mt-3 text-sm text-muted">
          Send payment to <strong>{momoInfo.momo}</strong> and wait for the shop to confirm. Order #{momoInfo.orderId}.
        </p>
        <button type="button" className="btn-primary mt-6" onClick={() => navigate(`/dashboard/orders/${momoInfo.orderId}`)}>
          View order
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-lg px-4 py-8 pb-24">
      <h1 className="text-xl font-extrabold">Checkout — {shop?.name}</h1>
      <p className="mt-1 text-sm text-muted">You pay the shop directly. DanyPathMart does not take commission.</p>

      {error && <p className="mt-4 rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red">{error}</p>}

      <fieldset className="mt-6 space-y-2">
        <legend className="text-sm font-bold">Fulfillment</legend>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm">
          <input type="radio" name="fulfillment" checked={fulfillmentMode === 'delivery'} onChange={() => setFulfillmentMode('delivery')} />
          Delivery to my address
        </label>
        {pickupAvailable && (
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm">
            <input type="radio" name="fulfillment" checked={fulfillmentMode === 'shop_pickup'} onChange={() => setFulfillmentMode('shop_pickup')} />
            Pick up at shop
          </label>
        )}
      </fieldset>

      {fulfillmentMode === 'delivery' && (
        <div className="mt-4">
          <label className="text-sm font-bold">Delivery address</label>
          {addressesLoading ? (
            <p className="mt-2 text-sm text-muted">Loading addresses…</p>
          ) : addresses.length === 0 ? (
            <p className="mt-2 rounded-xl border border-brand-gold/40 bg-brand-gold/10 px-3 py-3 text-sm">
              No saved addresses yet.{' '}
              <Link to="/dashboard/addresses" className="font-bold text-brand-green hover:underline">
                Add one in your account
              </Link>
              , then return here.
            </p>
          ) : (
            <select
              className="mt-2 w-full rounded-xl border border-black/10 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
              value={addressId}
              onChange={(e) => setAddressId(e.target.value)}
              required
            >
              <option value="">Select address</option>
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.recipient_name || a.street}, {a.city}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <fieldset className="mt-6 space-y-2">
        <legend className="text-sm font-bold">Payment method</legend>
        {paymentMethods.length === 0 ? (
          <p className="rounded-xl border border-brand-red/30 bg-brand-red/10 px-3 py-3 text-sm text-brand-red">
            This shop has no payment methods enabled yet. Contact the shop or try again later.
          </p>
        ) : (
          paymentMethods.map((m) => (
            <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm">
              <input
                type="radio"
                name="pay"
                checked={paymentMethod === m.id}
                onChange={() => setPaymentMethod(m.id)}
              />
              {m.label}
            </label>
          ))
        )}
      </fieldset>

      <div className="mt-4">
        <label className="text-sm font-bold">Notes (optional)</label>
        <textarea className="mt-2 w-full rounded-xl border border-black/10 p-3 text-sm dark:border-white/15 dark:bg-transparent" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="mt-6 flex items-center justify-between rounded-2xl bg-brand-green/10 px-4 py-4">
        <span className="font-bold">Total</span>
        <span className="text-lg font-extrabold text-brand-green">{formatPrice(subtotal())}</span>
      </div>

      <button
        type="submit"
        disabled={
          placeOrder.isPending
          || !paymentMethod
          || (fulfillmentMode === 'delivery' && (!addressId || addresses.length === 0))
        }
        className="btn-primary mt-6 w-full min-h-[48px]"
      >
        {placeOrder.isPending ? 'Placing order…' : 'Place order'}
      </button>

      <StorefrontLegalNotice className="mt-4" />
    </form>
  );
}
