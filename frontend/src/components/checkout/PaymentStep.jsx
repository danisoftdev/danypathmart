import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatPrice } from '../../lib/currency';
import { useCartStore } from '../../store/cartStore';
import {
  useCreateOrder,
  useDevConfirm,
  useInitPayment,
  usePayWithWallet,
  useSubmitBankTransfer,
} from '../../hooks/checkout';
import { usePaymentSettings, useWallet } from '../../hooks/wallet';
import { useAuthStore } from '../../store/authStore';
import WhatsAppOptIn from './WhatsAppOptIn';

function buildCustomizations(cartItems) {
  return cartItems
    .filter((i) => i.custom_proof?.file_path || i.custom_proof?.label_text)
    .map((i) => ({
      product_id: i.id,
      file_path: i.custom_proof?.file_path || undefined,
      label_text: i.custom_proof?.label_text || undefined,
    }));
}

function orderExtras(cartItems, notifyWhatsapp) {
  const customizations = buildCustomizations(cartItems);
  return {
    notify_whatsapp: notifyWhatsapp,
    ...(customizations.length > 0 ? { customizations } : {}),
  };
}

const METHOD_META = {
  paystack: { icon: '💳', label: 'Paystack', desc: 'Card or mobile money' },
  wallet: { icon: '💰', label: 'Wallet', desc: 'Store credit' },
  bank_transfer: { icon: '🏦', label: 'Bank transfer', desc: 'Pay by transfer' },
  pod: { icon: '🚚', label: 'Pay on delivery', desc: 'Pay when order arrives' },
};

function pickDefaultMethod(methods) {
  if (methods.includes('paystack')) return 'paystack';
  if (methods.includes('wallet')) return 'wallet';
  return methods[0] || 'paystack';
}

async function openPaystack(session, orderId, { onSuccess, onCancel, onError }) {
  const { default: PaystackPop } = await import('@paystack/inline-js');
  if (session.dev_mock) {
    return { devMock: true };
  }
  if (session.access_code) {
    const popup = new PaystackPop();
    popup.resumeTransaction(session.access_code, { onSuccess, onCancel, onError });
    return { opened: true };
  }
  if (session.authorization_url) {
    window.location.href = session.authorization_url;
    return { redirected: true };
  }
  throw new Error('No payment session');
}

export default function PaymentStep({ items, addressId, pickupStationId, quote, onBack, pickupMode = false }) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isCustomer = user?.role === 'customer';
  const clearCart = useCartStore((s) => s.clearCart);
  const cartItems = useCartStore((s) => s.items);
  const createOrder = useCreateOrder();
  const initPayment = useInitPayment();
  const devConfirm = useDevConfirm();
  const payWallet = usePayWithWallet();
  const submitBank = useSubmitBankTransfer();
  const {
    data: paymentSettings,
    isLoading: settingsLoading,
    isError: settingsError,
  } = usePaymentSettings();
  const { data: walletData, isLoading: walletLoading } = useWallet({
    enabled: isCustomer,
  });

  const methods = useMemo(() => {
    const raw = paymentSettings?.methods;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.filter((m) => typeof m === 'string');
    }
    return ['paystack'];
  }, [paymentSettings]);

  const payBeforeDelivery = paymentSettings?.pay_before_delivery !== false;
  const bank = paymentSettings?.bank ?? {};
  const walletBalance = isCustomer ? (walletData?.balance ?? 0) : 0;

  const [method, setMethod] = useState(() => pickDefaultMethod(['paystack']));
  const [applyWallet, setApplyWallet] = useState(false);
  const [walletAmount, setWalletAmount] = useState('');
  const [bankRef, setBankRef] = useState('');
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(false);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setMethod((current) => (methods.includes(current) ? current : pickDefaultMethod(methods)));
  }, [methods]);

  const total = quote?.total ?? 0;
  const walletEnabled = methods.includes('wallet') && isCustomer;
  const paystackEnabled = methods.includes('paystack');
  const bankEnabled = methods.includes('bank_transfer');
  const podEnabled = methods.includes('pod');

  const parsedWallet = useMemo(() => {
    const n = parseFloat(walletAmount);
    if (Number.isNaN(n) || n < 0) return 0;
    return Math.min(n, walletBalance, total);
  }, [walletAmount, walletBalance, total]);

  const busy =
    status === 'working' ||
    createOrder.isPending ||
    initPayment.isPending ||
    payWallet.isPending ||
    submitBank.isPending;

  const finish = (orderId) => {
    clearCart();
    navigate(`/order/${orderId}`, { replace: true });
  };

  const runPaystack = async (orderId) => {
    const session = await initPayment.mutateAsync(orderId);
    const result = await openPaystack(session, orderId, {
      onSuccess: () => finish(orderId),
      onCancel: () => {
        setStatus('idle');
        setMessage('Payment cancelled. Your order is saved — complete payment from your order page.');
      },
      onError: () => {
        setStatus('error');
        setMessage('Payment failed. Please try again.');
      },
    });
    if (result?.devMock) {
      await devConfirm.mutateAsync(orderId);
      finish(orderId);
    }
  };

  const applyWalletIfNeeded = async (orderId, amount) => {
    if (!walletEnabled || amount <= 0) return { paid: false, amount_due: total };
    return payWallet.mutateAsync({ orderId, amount });
  };

  const checkout = async () => {
    setStatus('working');
    setMessage('');

    try {
      if (method === 'pod') {
        if (!podEnabled) throw new Error('Pay on delivery is not available.');
        const order = await createOrder.mutateAsync({
          items,
          address_id: addressId,
          pickup_station_id: pickupStationId,
          payment_method: 'pod',
          ...orderExtras(cartItems, notifyWhatsapp),
        });
        finish(order.order_id);
        return;
      }

      if (method === 'bank_transfer') {
        if (!bankEnabled) throw new Error('Bank transfer is not available.');
        if (!bankRef.trim()) {
          setStatus('error');
          setMessage('Enter your bank transfer reference before placing the order.');
          return;
        }
        const order = await createOrder.mutateAsync({
          items,
          address_id: addressId,
          pickup_station_id: pickupStationId,
          payment_method: 'bank_transfer',
          ...orderExtras(cartItems, notifyWhatsapp),
        });
        await submitBank.mutateAsync({ orderId: order.order_id, reference: bankRef.trim() });
        finish(order.order_id);
        return;
      }

      const createMethod = method === 'wallet' ? 'wallet' : 'paystack';
      const order = await createOrder.mutateAsync({
        items,
        address_id: addressId,
        pickup_station_id: pickupStationId,
        payment_method: createMethod,
        ...orderExtras(cartItems, notifyWhatsapp),
      });
      const orderId = order.order_id;

      let walletToApply = 0;
      if (method === 'wallet') {
        walletToApply = Math.min(walletBalance, total);
        if (walletToApply <= 0) {
          setStatus('error');
          setMessage('Your wallet balance is zero. Choose another payment method.');
          return;
        }
      } else if (applyWallet && walletEnabled && walletBalance > 0) {
        walletToApply = parsedWallet > 0 ? parsedWallet : Math.min(walletBalance, total);
      }

      if (walletToApply > 0) {
        const walletRes = await applyWalletIfNeeded(orderId, walletToApply);
        if (walletRes.paid) {
          finish(orderId);
          return;
        }
      }

      if (method === 'wallet' && !paystackEnabled) {
        setStatus('error');
        setMessage('Wallet balance is not enough to cover this order. Top up via refunds or choose Paystack.');
        return;
      }

      if (!paystackEnabled) {
        setStatus('error');
        setMessage('Online payment is not available. Contact support.');
        return;
      }

      await runPaystack(orderId);
    } catch (err) {
      setStatus('error');
      const detail = err?.response?.data;
      if (detail?.code === 'cart_invalid') {
        setMessage('Some items are no longer available. Please review your cart.');
      } else if (detail?.code === 'insufficient_wallet') {
        setMessage('Insufficient wallet balance for that amount.');
      } else {
        setMessage(detail?.message || err?.message || 'Could not complete checkout. Please try again.');
      }
    }
  };

  const showWalletApply =
    walletEnabled &&
    walletBalance > 0 &&
    method === 'paystack' &&
    paystackEnabled;

  const actionLabel = (() => {
    if (busy) return 'Processing…';
    if (method === 'pod') return pickupMode ? 'Place order — pay on collection' : 'Place order — pay on delivery';
    if (method === 'bank_transfer') return 'Place order & submit transfer ref';
    if (method === 'wallet' && walletBalance >= total) return `Pay ${formatPrice(total)} from wallet`;
    if (method === 'wallet') return 'Pay with wallet + Paystack';
    if (applyWallet && parsedWallet > 0) {
      const remainder = Math.max(0, total - parsedWallet);
      return remainder > 0
        ? `Pay ${formatPrice(remainder)} with Paystack`
        : `Pay ${formatPrice(total)} from wallet`;
    }
    return `Pay ${formatPrice(total)} with Paystack`;
  })();

  if (!quote) {
    return (
      <div className="py-8 text-center">
        <p className="font-semibold text-brand-green">Loading payment details…</p>
        <p className="mt-2 text-sm text-muted">Calculating your order total.</p>
        <button type="button" onClick={onBack} className="mt-6 text-sm font-bold text-brand-green hover:underline">
          ← Back to summary
        </button>
      </div>
    );
  }

  if (settingsLoading || (walletEnabled && walletLoading)) {
    return (
      <div className="space-y-4 py-4">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-black/5 dark:bg-white/10" />
        <div className="h-32 animate-pulse rounded-2xl bg-black/5 dark:bg-white/10" />
        <div className="h-48 animate-pulse rounded-2xl bg-black/5 dark:bg-white/10" />
      </div>
    );
  }

  if (settingsError) {
    return (
      <div className="py-6">
        <p className="rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red">
          Could not load payment options. Check your connection and try again.
        </p>
        <button type="button" onClick={onBack} className="mt-4 text-sm font-bold text-brand-green hover:underline">
          ← Back to summary
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-extrabold text-[#111111] dark:text-white">Payment</h2>
        <p className="mt-1 text-sm text-muted">All amounts in Ghana Cedis (GHS).</p>
      </div>

      {payBeforeDelivery && method !== 'pod' && (
        <p className="mb-4 rounded-xl border border-brand-green/25 bg-brand-green/10 px-4 py-3 text-sm text-brand-green">
          {pickupMode
            ? 'Pay before pickup — we prepare your order only after payment is confirmed.'
            : 'Pay before delivery — we prepare and ship only after payment is confirmed.'}
        </p>
      )}

      {method === 'pod' && (
        <p className="mb-4 rounded-xl border border-brand-gold/40 bg-brand-gold/15 px-4 py-3 text-sm text-amber-900 dark:text-brand-gold">
          {pickupMode
            ? 'Pay on collection — have the exact order total ready in cash (GHS) when you pick up at the station.'
            : 'Pay on delivery — have the exact order total ready in cash (GHS) for the driver. No online payment required now.'}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-black/8 bg-[#FFF9F3] dark:border-white/10 dark:bg-[#1E1E1E]">
        <div className="bg-gradient-to-br from-brand-green to-[#1a5c38] p-6 text-white">
          <p className="text-sm font-medium text-white/80">Order total</p>
          <p className="mt-1 text-4xl font-extrabold tracking-tight">{formatPrice(total)}</p>
          {walletEnabled && walletBalance > 0 && (
            <p className="mt-2 text-sm text-white/80">Wallet available: {formatPrice(walletBalance)}</p>
          )}
        </div>

        <div className="space-y-4 p-5">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Choose how to pay</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {methods.map((key) => {
                const meta = METHOD_META[key] || { icon: '💳', label: key, desc: '' };
                const active = method === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMethod(key)}
                    className={[
                      'rounded-xl px-2 py-3 text-center transition',
                      active ? 'bg-brand-green/10 ring-2 ring-brand-green/40' : 'bg-black/[0.03] dark:bg-white/5',
                    ].join(' ')}
                  >
                    <span className="text-xl">{meta.icon}</span>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wide">{meta.label}</p>
                    <p className="mt-0.5 text-[9px] text-muted">{meta.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {showWalletApply && (
            <div className="rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={applyWallet}
                  onChange={(e) => {
                    setApplyWallet(e.target.checked);
                    if (e.target.checked && !walletAmount) {
                      setWalletAmount(String(Math.min(walletBalance, total).toFixed(2)));
                    }
                  }}
                  className="h-4 w-4 accent-brand-green"
                />
                Apply wallet credit first
              </label>
              {applyWallet && (
                <label className="mt-3 block text-sm">
                  <span className="mb-1 block font-semibold">Wallet amount (GHS)</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={Math.min(walletBalance, total)}
                    className="input-field text-sm"
                    value={walletAmount}
                    onChange={(e) => setWalletAmount(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted">
                    Remainder via Paystack:{' '}
                    <span className="font-bold">{formatPrice(Math.max(0, total - parsedWallet))}</span>
                  </p>
                </label>
              )}
            </div>
          )}

          {method === 'wallet' && walletEnabled && (
            <p className="text-sm text-muted">
              {walletBalance >= total
                ? 'Your wallet covers the full order total.'
                : `We will use ${formatPrice(Math.min(walletBalance, total))} from your wallet, then Paystack for the rest.`}
            </p>
          )}

          {method === 'bank_transfer' && (
            <div className="rounded-xl border border-black/8 p-4 dark:border-white/10">
              <p className="text-sm font-bold">Transfer to our account</p>
              {bank.bank_name || bank.bank_account_number ? (
                <dl className="mt-2 space-y-1 text-sm">
                  {bank.bank_name && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted">Bank</dt>
                      <dd className="font-semibold">{bank.bank_name}</dd>
                    </div>
                  )}
                  {bank.bank_account_name && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted">Account name</dt>
                      <dd className="font-semibold">{bank.bank_account_name}</dd>
                    </div>
                  )}
                  {bank.bank_account_number && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted">Account number</dt>
                      <dd className="font-mono font-bold">{bank.bank_account_number}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-2 border-t border-black/5 pt-2 dark:border-white/10">
                    <dt className="text-muted">Amount</dt>
                    <dd className="font-bold text-brand-green">{formatPrice(total)}</dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-2 text-sm text-brand-red">
                  Bank details are not configured yet. Contact support or choose another method.
                </p>
              )}
              <label className="mt-4 block text-sm">
                <span className="mb-1 block font-semibold">Your transfer reference</span>
                <input
                  className="input-field text-sm"
                  value={bankRef}
                  onChange={(e) => setBankRef(e.target.value)}
                  placeholder="e.g. TXN123456789"
                />
              </label>
            </div>
          )}

          <WhatsAppOptIn checked={notifyWhatsapp} onChange={setNotifyWhatsapp} />

          {message && (
            <div
              className={`rounded-xl px-4 py-3 text-sm ${
                status === 'error'
                  ? 'bg-brand-red/10 text-brand-red'
                  : 'bg-brand-gold/15 text-amber-900 dark:text-brand-gold'
              }`}
            >
              {message}
            </div>
          )}

          <button
            type="button"
            onClick={checkout}
            disabled={
              busy ||
              (method === 'bank_transfer' && !(bank.bank_name || bank.bank_account_number))
            }
            className="btn-primary min-h-[52px] w-full text-base"
          >
            {actionLabel}
          </button>
        </div>
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="min-h-[48px] rounded-xl border-2 border-black/10 px-6 font-bold disabled:opacity-50 dark:border-white/15"
        >
          ← Back to summary
        </button>
      </div>
    </div>
  );
}
