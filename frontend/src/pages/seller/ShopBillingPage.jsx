import { useEffect, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import {
  useConfirmShopBillingDevPayment,
  useInitializeShopRenewalPayment,
  useShopBillingLedger,
  useShopBillingAutoRenew,
  useShopBillingPaymentMethods,
} from '../../hooks/shop';
import { formatPrice } from '../../lib/currency';
import { printShopBillingReceipt } from '../../lib/shopBillingDocuments';

function typeLabel(p) {
  if (p.is_complimentary) return 'Complimentary / free';
  if (p.payment_type === 'registration') return 'Registration';
  if (p.payment_type === 'renewal') return 'Renewal';
  if (p.payment_type === 'card_setup') return 'Card setup';
  if (p.payment_type === 'complimentary') return 'Complimentary / free';
  return p.payment_type || 'Payment';
}

export default function ShopBillingPage() {
  const { shop, dashboard } = useOutletContext();
  const billing = dashboard?.billing ?? {};
  const { data, isLoading, refetch } = useShopBillingLedger();
  const autoRenewMut = useShopBillingAutoRenew();
  const methodsMut = useShopBillingPaymentMethods();
  const initRenewal = useInitializeShopRenewalPayment();
  const confirmDev = useConfirmShopBillingDevPayment();
  const [searchParams, setSearchParams] = useSearchParams();
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [period, setPeriod] = useState(null);

  const payments = data?.payments ?? [];
  const methods = data?.methods ?? [];
  const subscription = data?.subscription ?? billing.subscription;
  const settings = data?.settings ?? billing.settings ?? {};
  const fees = settings.paystack_fees || {};
  const preferredPeriod = settings.renewal_period || 'yearly';

  useEffect(() => {
    if (period == null && preferredPeriod) {
      setPeriod(preferredPeriod);
    }
  }, [preferredPeriod, period]);

  useEffect(() => {
    const kind = searchParams.get('shop_payment');
    const ref = searchParams.get('reference') || '';
    const isMock = searchParams.get('mock') === '1';
    if (!kind || !isMock || !ref) return;
    (async () => {
      try {
        await confirmDev.mutateAsync({
          reference: ref,
          type: kind === 'card_setup' ? 'renewal' : kind,
        });
        setMsg(kind === 'card_setup' ? 'Card setup confirmed (dev).' : 'Payment confirmed.');
        refetch();
      } catch {
        setErr('Could not confirm payment.');
      } finally {
        setSearchParams({}, { replace: true });
      }
    })();
  }, [searchParams, confirmDev, setSearchParams, refetch]);

  const renewalOptions = settings.renewal_options?.length
    ? settings.renewal_options
    : [
        ...(Number(settings.renewal_fee_monthly || 0) > 0
          ? [{ period: 'monthly', fee: Number(settings.renewal_fee_monthly), label: 'Monthly' }]
          : []),
        ...(Number(settings.renewal_fee_yearly || 0) > 0
          ? [{ period: 'yearly', fee: Number(settings.renewal_fee_yearly), label: 'Yearly' }]
          : []),
      ];

  const onRenew = async () => {
    setErr('');
    setMsg('');
    try {
      const res = await initRenewal.mutateAsync({ period: period || preferredPeriod });
      if (res.authorization_url) {
        window.location.href = res.authorization_url;
        return;
      }
      setMsg('Renewal initialized.');
      refetch();
    } catch (e) {
      setErr(e.response?.data?.message || 'Could not start renewal payment.');
    }
  };

  const onAddCard = async () => {
    setErr('');
    setMsg('');
    try {
      const res = await methodsMut.mutateAsync({ action: 'setup' });
      if (res.payment?.authorization_url) {
        window.location.href = res.payment.authorization_url;
        return;
      }
      setMsg('Card setup started.');
      refetch();
    } catch (e) {
      setErr(e.response?.data?.message || 'Could not start card setup.');
    }
  };

  const onAutoRenew = async (enabled) => {
    setErr('');
    setMsg('');
    try {
      await autoRenewMut.mutateAsync({ auto_renew: enabled, period: period || preferredPeriod });
      setMsg(enabled ? 'Automatic renewal is on.' : 'Automatic renewal is off.');
      refetch();
    } catch (e) {
      setErr(e.response?.data?.message || 'Could not update auto-renew.');
    }
  };

  const onPrint = async (paymentId) => {
    try {
      const { default: api } = await import('../../lib/api');
      const { data: res } = await api.get('/shop/billing/receipt', { params: { id: paymentId } });
      printShopBillingReceipt(res.receipt, shop?.name);
    } catch (e) {
      setErr(e.response?.data?.message || 'Could not load receipt.');
    }
  };

  return (
    <div>
      <h1 className="text-xl font-extrabold md:text-2xl">Subscription & receipts</h1>
      <p className="mt-1 text-sm text-muted">
        Payment history (including free periods), PDF receipts, and optional automatic renewal with a saved card.
      </p>

      {msg && <p className="mt-4 rounded-xl bg-brand-green/10 px-4 py-3 text-sm font-bold text-brand-green">{msg}</p>}
      {err && <p className="mt-4 rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red">{err}</p>}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-black/8 bg-white p-5 dark:border-white/10 dark:bg-[#1E1E1E]">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Current period</p>
          <p className="mt-2 text-sm">
            Status: <strong>{subscription?.status || '—'}</strong>
            {(() => {
              let plan = subscription?.period || subscription?.renewal_period || null;
              if (!plan && subscription?.period_start && subscription?.period_end) {
                const days = Math.round(
                  (new Date(subscription.period_end).getTime() - new Date(subscription.period_start).getTime()) / 86400000
                );
                plan = days >= 300 ? 'yearly' : days >= 20 ? 'monthly' : null;
              }
              if (plan === 'yearly') {
                return <span className="ml-2 rounded-full bg-brand-green/15 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-green">Yearly</span>;
              }
              if (plan === 'monthly') {
                return <span className="ml-2 rounded-full bg-brand-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase text-[#92400E] dark:text-brand-gold">Monthly</span>;
              }
              return null;
            })()}
          </p>
          {subscription?.period_end ? (
            <p className="mt-1 text-sm">
              Ends <strong>{subscription.period_end}</strong>
              {billing.days_until_expiry != null ? (
                <span className="text-muted"> · {billing.days_until_expiry} day(s) remaining</span>
              ) : null}
            </p>
          ) : billing.days_until_expiry != null ? (
            <p className="mt-1 text-xs text-muted">{billing.days_until_expiry} day(s) remaining</p>
          ) : null}
          {fees.mode && (
            <p className="mt-3 text-xs text-muted">
              Paystack fees:{' '}
              {fees.mode === 'pass_to_payer'
                ? `added to your charge (~${fees.percent}% + ${formatPrice(fees.flat_ghs || 0)})`
                : 'absorbed by DanyPathMart (shown on receipts for transparency)'}
              {fees.note ? ` — ${fees.note}` : ''}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-black/8 bg-white p-5 dark:border-white/10 dark:bg-[#1E1E1E]">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Renew / pay</p>
          {renewalOptions.length > 0 ? (
            <>
              <div className="mt-2 space-y-2">
                {renewalOptions.map((o) => {
                  const selected = (period || preferredPeriod) === o.period;
                  const recommended = o.period === preferredPeriod;
                  return (
                    <button
                      key={o.period}
                      type="button"
                      onClick={() => setPeriod(o.period)}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm font-bold ${
                        selected
                          ? 'border-brand-green bg-brand-green/10 text-brand-green'
                          : 'border-black/10 dark:border-white/15'
                      }`}
                    >
                      <span>
                        {o.label} — {formatPrice(o.fee)}
                        {recommended ? (
                          <span className="ml-2 rounded-full bg-brand-gold/25 px-2 py-0.5 text-[10px] font-bold uppercase text-[#92400E] dark:text-brand-gold">
                            Recommended
                          </span>
                        ) : null}
                      </span>
                      {selected ? <span aria-hidden>✓</span> : null}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="btn-primary mt-3 w-full min-h-[44px]"
                disabled={initRenewal.isPending}
                onClick={onRenew}
              >
                {initRenewal.isPending ? 'Starting…' : 'Pay renewal'}
              </button>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">No renewal plans are configured yet.</p>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-black/8 bg-white p-5 dark:border-white/10 dark:bg-[#1E1E1E]">
        <h2 className="font-extrabold">Automatic renewal</h2>
        <p className="mt-1 text-sm text-muted">
          Opt in to charge your saved card when the period ends. Cards are stored with Paystack — we never keep full card numbers.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-ghost min-h-[40px] px-4 text-sm" onClick={onAddCard} disabled={methodsMut.isPending}>
            {methodsMut.isPending ? 'Opening Paystack…' : 'Add / update card (GHS 1 setup)'}
          </button>
          <button
            type="button"
            className="btn-primary min-h-[40px] px-4 text-sm"
            disabled={autoRenewMut.isPending}
            onClick={() => onAutoRenew(!(Number(subscription?.auto_renew) === 1))}
          >
            {Number(subscription?.auto_renew) === 1 ? 'Turn auto-renew off' : 'Turn auto-renew on'}
          </button>
        </div>
        {methods.length > 0 && (
          <ul className="mt-4 space-y-2 text-sm">
            {methods.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/8 px-3 py-2 dark:border-white/10">
                <span>
                  {(m.card_type || 'Card').toString()} •••• {m.last4 || '????'}
                  {m.exp_month && m.exp_year ? ` · ${m.exp_month}/${m.exp_year}` : ''}
                  {m.is_default ? ' · Default' : ''}
                </span>
                <button
                  type="button"
                  className="text-xs font-semibold text-brand-red"
                  onClick={async () => {
                    try {
                      await methodsMut.mutateAsync({ action: 'remove', method_id: m.id });
                      refetch();
                    } catch (e) {
                      setErr(e.response?.data?.message || 'Could not remove card.');
                    }
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-black/8 bg-white p-5 dark:border-white/10 dark:bg-[#1E1E1E]">
        <h2 className="font-extrabold">Payment history</h2>
        {isLoading ? (
          <p className="mt-3 text-sm text-muted">Loading…</p>
        ) : payments.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No receipts yet. Free periods and paid renewals will appear here.</p>
        ) : (
          <ul className="mt-4 divide-y divide-black/8 dark:divide-white/10">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-semibold">
                    {typeLabel(p)}
                    {p.is_complimentary ? (
                      <span className="ml-2 text-xs font-bold text-brand-green">FREE</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted">
                    {p.receipt_number || `#{p.id}`} · {p.paid_at || p.created_at}
                    {p.billing_period ? ` · ${p.billing_period}` : ''}
                  </p>
                  {p.notes && <p className="mt-1 text-xs text-muted">{p.notes}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold">{formatPrice(p.amount_ghs)}</span>
                  <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => onPrint(p.id)}>
                    Save PDF
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
