import { useState } from 'react';
import { formatPrice } from '../../lib/currency';
import {
  useDevConfirm,
  useInitPayment,
  usePayWithWallet,
  useSubmitBankTransfer,
} from '../../hooks/checkout';
import { usePaymentSettings, useWallet } from '../../hooks/wallet';

const METHOD_LABELS = {
  paystack: 'Paystack',
  wallet: 'Wallet',
  wallet_paystack: 'Wallet + Paystack',
  bank_transfer: 'Bank transfer',
  pod: 'Pay on delivery',
};

export default function CompletePaymentPanel({ order, onPaid }) {
  const initPayment = useInitPayment();
  const devConfirm = useDevConfirm();
  const payWallet = usePayWithWallet();
  const submitBank = useSubmitBankTransfer();
  const { data: paymentSettings } = usePaymentSettings();
  const { data: walletData } = useWallet();

  const [bankRef, setBankRef] = useState('');
  const [applyWallet, setApplyWallet] = useState(false);
  const [walletAmount, setWalletAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const paid = order.payment_status === 'paid';
  const isPod = order.payment_method === 'pod';
  const bank = paymentSettings?.bank ?? {};
  const methods = paymentSettings?.methods ?? [];
  const walletBalance = walletData?.balance ?? 0;
  const amountDue = order.amount_due ?? Math.max(0, order.total - (order.wallet_paid || 0));
  const walletPaid = order.wallet_paid || 0;

  if (paid) {
    return (
      <div className="mt-4 space-y-2 text-sm">
        {walletPaid > 0 && (
          <p className="text-muted">
            Paid from wallet: <span className="font-bold text-brand-green">{formatPrice(walletPaid)}</span>
          </p>
        )}
        {order.payment_method && (
          <p className="capitalize text-muted">
            Payment: {METHOD_LABELS[order.payment_method] || order.payment_method.replace(/_/g, ' ')}
          </p>
        )}
      </div>
    );
  }

  if (isPod) {
    return (
      <p className="mt-4 rounded-xl border border-brand-gold/40 bg-brand-gold/15 px-4 py-3 text-sm text-amber-900 dark:text-brand-gold">
        Pay on delivery — have <span className="font-bold">{formatPrice(order.total)}</span> in cash ready for the driver when your order arrives.
      </p>
    );
  }

  const runPaystack = async () => {
    const session = await initPayment.mutateAsync(order.id);
    if (session.dev_mock) {
      await devConfirm.mutateAsync(order.id);
      onPaid?.();
      return;
    }
    const { default: PaystackPop } = await import('@paystack/inline-js');
    if (session.access_code) {
      const popup = new PaystackPop();
      popup.resumeTransaction(session.access_code, {
        onSuccess: () => onPaid?.(),
        onCancel: () => setMessage('Payment cancelled.'),
        onError: () => setMessage('Payment failed.'),
      });
      return;
    }
    if (session.authorization_url) {
      window.location.href = session.authorization_url;
    }
  };

  const payOnline = async () => {
    setBusy(true);
    setMessage('');
    try {
      const parsed = parseFloat(walletAmount);
      const toApply =
        applyWallet && methods.includes('wallet')
          ? Math.min(
              Number.isNaN(parsed) ? walletBalance : parsed,
              walletBalance,
              amountDue
            )
          : 0;
      if (toApply > 0) {
        const res = await payWallet.mutateAsync({ orderId: order.id, amount: toApply });
        if (res.paid) {
          onPaid?.();
          return;
        }
      }
      if (!methods.includes('paystack')) {
        setMessage('Paystack is not available. Contact support.');
        return;
      }
      await runPaystack();
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Could not process payment.');
    } finally {
      setBusy(false);
    }
  };

  const submitBankRef = async () => {
    if (!bankRef.trim()) {
      setMessage('Enter your transfer reference.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await submitBank.mutateAsync({ orderId: order.id, reference: bankRef.trim() });
      onPaid?.();
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Could not submit reference.');
    } finally {
      setBusy(false);
    }
  };

  if (order.payment_method === 'bank_transfer') {
    return (
      <div className="mt-4 space-y-3">
        <p className="rounded-xl bg-brand-gold/15 px-4 py-3 text-sm text-amber-900 dark:text-brand-gold">
          {order.bank_transfer_ref
            ? `Transfer reference submitted (${order.bank_transfer_ref}). We will confirm payment soon.`
            : 'Complete your bank transfer, then submit your reference below.'}
        </p>
        {!order.bank_transfer_ref && (
          <>
            {(bank.bank_name || bank.bank_account_number) && (
              <dl className="rounded-xl border border-black/8 p-4 text-sm dark:border-white/10">
                {bank.bank_name && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted">Bank</dt>
                    <dd className="font-semibold">{bank.bank_name}</dd>
                  </div>
                )}
                {bank.bank_account_name && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted">Account name</dt>
                    <dd>{bank.bank_account_name}</dd>
                  </div>
                )}
                {bank.bank_account_number && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted">Account #</dt>
                    <dd className="font-mono font-bold">{bank.bank_account_number}</dd>
                  </div>
                )}
                <div className="mt-2 flex justify-between border-t border-black/5 pt-2 dark:border-white/10">
                  <dt className="text-muted">Amount</dt>
                  <dd className="font-bold text-brand-green">{formatPrice(order.total)}</dd>
                </div>
              </dl>
            )}
            <input
              className="input-field w-full text-sm"
              value={bankRef}
              onChange={(e) => setBankRef(e.target.value)}
              placeholder="Transfer reference"
            />
            <button type="button" onClick={submitBankRef} disabled={busy} className="btn-primary w-full py-3">
              {busy ? 'Submitting…' : 'Submit transfer reference'}
            </button>
          </>
        )}
        {message && <p className="text-sm text-brand-red">{message}</p>}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {walletPaid > 0 && (
        <p className="text-sm text-muted">
          Wallet applied: <span className="font-bold text-brand-green">{formatPrice(walletPaid)}</span>
          {' · '}
          Remaining: <span className="font-bold">{formatPrice(amountDue)}</span>
        </p>
      )}
      {methods.includes('wallet') && walletBalance > 0 && amountDue > 0 && (
        <div className="rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-3">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={applyWallet}
              onChange={(e) => {
                setApplyWallet(e.target.checked);
                if (e.target.checked) setWalletAmount(String(Math.min(walletBalance, amountDue).toFixed(2)));
              }}
              className="h-4 w-4 accent-brand-green"
            />
            Use wallet ({formatPrice(walletBalance)} available)
          </label>
          {applyWallet && (
            <input
              type="number"
              className="input-field mt-2 w-full text-sm"
              value={walletAmount}
              onChange={(e) => setWalletAmount(e.target.value)}
              max={Math.min(walletBalance, amountDue)}
              min="0.01"
              step="0.01"
            />
          )}
        </div>
      )}
      {methods.includes('paystack') && amountDue > 0 && (
        <button type="button" onClick={payOnline} disabled={busy} className="btn-primary w-full py-3">
          {busy ? 'Processing…' : `Pay ${formatPrice(amountDue)} with Paystack`}
        </button>
      )}
      {message && <p className="text-sm text-brand-red">{message}</p>}
    </div>
  );
}
