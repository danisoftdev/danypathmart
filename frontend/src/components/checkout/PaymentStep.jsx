import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PaystackPop from '@paystack/inline-js';
import { formatPrice } from '../../lib/currency';
import { useCartStore } from '../../store/cartStore';
import { useCreateOrder, useDevConfirm, useInitPayment } from '../../hooks/checkout';

export default function PaymentStep({ items, addressId, quote, onBack }) {
  const navigate = useNavigate();
  const clearCart = useCartStore((s) => s.clearCart);
  const createOrder = useCreateOrder();
  const initPayment = useInitPayment();
  const devConfirm = useDevConfirm();

  const [status, setStatus] = useState('idle'); // idle | working | error
  const [message, setMessage] = useState('');

  const busy = status === 'working' || createOrder.isPending || initPayment.isPending;

  function finish(orderId) {
    clearCart();
    navigate(`/order/${orderId}`, { replace: true });
  }

  async function pay() {
    setStatus('working');
    setMessage('');
    try {
      const order = await createOrder.mutateAsync({ items, address_id: addressId });
      const orderId = order.order_id;
      const session = await initPayment.mutateAsync(orderId);

      // Development mock: no live Paystack key configured.
      if (session.dev_mock) {
        await devConfirm.mutateAsync(orderId);
        finish(orderId);
        return;
      }

      // Live Paystack inline popup (channels were set server-side).
      if (session.access_code) {
        const popup = new PaystackPop();
        popup.resumeTransaction(session.access_code, {
          onSuccess: () => finish(orderId),
          onCancel: () => {
            setStatus('idle');
            setMessage('Payment was cancelled. Your order is saved and awaiting payment.');
          },
          onError: () => {
            setStatus('error');
            setMessage('Payment failed. Please try again.');
          },
        });
        return;
      }

      // Fallback: redirect to the hosted Paystack page.
      if (session.authorization_url) {
        window.location.href = session.authorization_url;
        return;
      }

      throw new Error('No payment session');
    } catch (err) {
      setStatus('error');
      const detail = err?.response?.data;
      if (detail?.code === 'cart_invalid') {
        setMessage('Some items are no longer available. Please review your cart.');
      } else {
        setMessage(detail?.message || 'Could not start payment. Please try again.');
      }
    }
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Payment</h2>

      <div className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/15 dark:bg-[#1c1c1c]">
        <div className="flex items-center justify-between">
          <span className="text-black/60 dark:text-white/60">Amount due</span>
          <span className="text-2xl font-bold text-brand-green">
            {quote ? formatPrice(quote.total) : '...'}
          </span>
        </div>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          Pay securely with Paystack &mdash; card or mobile money. Charged in Ghana Cedis (GHS).
        </p>

        {message && (
          <p
            className={`mt-4 text-sm ${
              status === 'error' ? 'text-red-500' : 'text-black/70 dark:text-white/70'
            }`}
          >
            {message}
          </p>
        )}

        <button
          type="button"
          onClick={pay}
          disabled={busy || !quote}
          className="mt-5 w-full rounded-lg bg-brand-green px-4 py-3 font-semibold text-white transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Processing...' : `Pay ${quote ? formatPrice(quote.total) : ''} with Paystack`}
        </button>
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="rounded-lg border border-black/15 px-5 py-2.5 font-medium disabled:opacity-50 dark:border-white/15"
        >
          Back
        </button>
      </div>
    </div>
  );
}
