import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatPrice } from '../../lib/currency';
import {
  useCreateOrder,
  useDevConfirm,
  useInitPayment,
  usePayWithWallet,
  useSubmitBankTransfer,
} from '../../hooks/checkout';
import { useValidateReferralCode } from '../../hooks/loyalty';
import { usePaymentSettings, useWallet } from '../../hooks/wallet';
import { useAuthStore } from '../../store/authStore';

const METHOD_META = {
  paystack: { icon: '💳', label: 'Paystack', desc: 'Card or mobile money' },
  wallet: { icon: '💰', label: 'Wallet', desc: 'Store credit' },
  bank_transfer: { icon: '🏦', label: 'Bank transfer', desc: 'Pay by transfer' },
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

export default function GroupPaymentStep({
  items,
  addressId,
  quote,
  organizationName,
  referralCode: initialReferral = '',
  onBack,
  onComplete,
}) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isCustomer = user?.role === 'customer';
  const createOrder = useCreateOrder();
  const initPayment = useInitPayment();
  const devConfirm = useDevConfirm();
  const payWallet = usePayWithWallet();
  const submitBank = useSubmitBankTransfer();
  const { data: paymentSettings, isLoading: settingsLoading, isError: settingsError } =
    usePaymentSettings();
  const { data: walletData, isLoading: walletLoading } = useWallet({ enabled: isCustomer });

  const methods = useMemo(() => {
    const raw = paymentSettings?.methods;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.filter((m) => m !== 'pod' && typeof m === 'string');
    }
    return ['paystack'];
  }, [paymentSettings]);

  const bank = paymentSettings?.bank ?? {};
  const walletBalance = isCustomer ? (walletData?.balance ?? 0) : 0;

  const [method, setMethod] = useState(() => pickDefaultMethod(['paystack']));
  const [applyWallet, setApplyWallet] = useState(false);
  const [walletAmount, setWalletAmount] = useState('');
  const [bankRef, setBankRef] = useState('');
  const [referralCode, setReferralCode] = useState(initialReferral);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (initialReferral) setReferralCode(initialReferral);
  }, [initialReferral]);

  const { data: referralCheck } = useValidateReferralCode(referralCode, referralCode.trim().length >= 4);

  useEffect(() => {
    setMethod((current) => (methods.includes(current) ? current : pickDefaultMethod(methods)));
  }, [methods]);

  const total = quote?.total ?? 0;
  const walletEnabled = methods.includes('wallet') && isCustomer;
  const paystackEnabled = methods.includes('paystack');
  const bankEnabled = methods.includes('bank_transfer');

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
    onComplete?.();
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

  const checkout = async () => {
    setStatus('working');
    setMessage('');

    try {
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
          payment_method: 'bank_transfer',
          order_type: 'group',
          organization_name: organizationName,
          referral_code: referralCode.trim() || undefined,
        });
        await submitBank.mutateAsync({ orderId: order.order_id, reference: bankRef.trim() });
        finish(order.order_id);
        return;
      }

      const createMethod = method === 'wallet' ? 'wallet' : 'paystack';
      const order = await createOrder.mutateAsync({
        items,
        address_id: addressId,
        payment_method: createMethod,
        order_type: 'group',
        organization_name: organizationName,
        referral_code: referralCode.trim() || undefined,
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
        const walletRes = await payWallet.mutateAsync({ orderId, amount: walletToApply });
        if (walletRes.paid) {
          finish(orderId);
          return;
        }
      }

      if (method === 'wallet' && !paystackEnabled) {
        setStatus('error');
        setMessage('Wallet balance is not enough. Top up or choose Paystack.');
        return;
      }

      if (!paystackEnabled) {
        setStatus('error');
        setMessage('Online payment is not available.');
        return;
      }

      await runPaystack(orderId);
    } catch (err) {
      setStatus('error');
      const detail = err?.response?.data;
      setMessage(detail?.message || err?.message || 'Could not complete checkout.');
    }
  };

  if (!quote || settingsLoading || (walletEnabled && walletLoading)) {
    return <p className="py-6 text-sm text-muted">Loading payment…</p>;
  }

  if (settingsError) {
    return (
      <p className="rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red">
        Could not load payment options.
      </p>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-extrabold">Payment</h2>
      <p className="mt-1 text-sm text-muted">Group order for {organizationName}</p>

      <div className="mt-4 overflow-hidden rounded-2xl border border-black/8 dark:border-white/10">
        <div className="bg-brand-green p-5 text-white">
          <p className="text-sm text-white/80">Order total</p>
          <p className="text-3xl font-extrabold">{formatPrice(total)}</p>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-3 gap-2">
            {methods.map((key) => {
              const meta = METHOD_META[key] || { icon: '💳', label: key, desc: '' };
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMethod(key)}
                  className={`rounded-xl px-2 py-3 text-center ${method === key ? 'ring-2 ring-brand-green/40 bg-brand-green/10' : 'bg-black/[0.03] dark:bg-white/5'}`}
                >
                  <span className="text-xl">{meta.icon}</span>
                  <p className="mt-1 text-[10px] font-bold uppercase">{meta.label}</p>
                </button>
              );
            })}
          </div>

          {method === 'bank_transfer' && (
            <div className="rounded-xl border p-4 text-sm">
              {bank.bank_account_number && (
                <p className="font-mono font-bold">{bank.bank_account_number}</p>
              )}
              <input
                className="input-field mt-3 text-sm"
                value={bankRef}
                onChange={(e) => setBankRef(e.target.value)}
                placeholder="Transfer reference"
              />
            </div>
          )}

          <div className="rounded-xl border border-black/8 p-4 dark:border-white/10">
            <p className="text-xs font-bold uppercase text-muted">Refer a club leader (optional)</p>
            <input
              className="input-field mt-2 text-sm uppercase"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              placeholder="CLUB-XXXXXX"
            />
            {referralCode.trim().length >= 4 && referralCheck?.valid && (
              <p className="mt-2 text-xs font-semibold text-brand-green">
                Referred by {referralCheck.referrer_name} — they earn wallet credit when you pay.
              </p>
            )}
            {referralCode.trim().length >= 4 && referralCheck && !referralCheck.valid && (
              <p className="mt-2 text-xs text-brand-red">Code not recognized — you can still checkout.</p>
            )}
          </div>

          {message && (
            <p className={`rounded-xl px-4 py-3 text-sm ${status === 'error' ? 'bg-brand-red/10 text-brand-red' : 'bg-brand-gold/15'}`}>
              {message}
            </p>
          )}

          <button type="button" onClick={checkout} disabled={busy} className="btn-primary w-full">
            {busy ? 'Processing…' : `Pay ${formatPrice(total)}`}
          </button>
        </div>
      </div>

      <button type="button" onClick={onBack} disabled={busy} className="mt-4 text-sm font-bold text-brand-green">
        ← Back
      </button>
    </div>
  );
}
