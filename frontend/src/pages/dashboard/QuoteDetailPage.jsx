import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuote, useConvertQuote } from '../../hooks/quotes';
import {
  useDevConfirm,
  useInitPayment,
  usePayWithWallet,
  useSubmitBankTransfer,
} from '../../hooks/checkout';
import { usePaymentSettings, useWallet } from '../../hooks/wallet';
import { formatPrice } from '../../lib/currency';
import ProductImage from '../../components/product/ProductImage';
import { FormPanelSkeleton } from '../../components/ui/Skeleton';
import PrintExportActions from '../../components/ui/PrintExportActions';
import { canPrintProforma, printProforma } from '../../lib/quoteDocuments';
import { useCompanyStore } from '../../store/companyStore';

const STATUS_LABEL = {
  requested: 'Awaiting review',
  proforma_sent: 'Proforma ready — pay when ready',
  approved_pay_later: 'Approved — pay by bank transfer',
  converted: 'Order placed',
  rejected: 'Not approved',
};

export default function QuoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const company = useCompanyStore((s) => s.company);
  const { data: quote, isLoading, refetch } = useQuote(id);
  const convertQuote = useConvertQuote();
  const initPayment = useInitPayment();
  const devConfirm = useDevConfirm();
  const payWallet = usePayWithWallet();
  const submitBank = useSubmitBankTransfer();
  const { data: paymentSettings } = usePaymentSettings();
  const { data: walletData } = useWallet();

  const [method, setMethod] = useState('paystack');
  const [bankRef, setBankRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const methods = (paymentSettings?.methods ?? ['paystack']).filter((m) => m !== 'pod');
  const bank = paymentSettings?.bank ?? {};
  const walletBalance = walletData?.balance ?? 0;

  const pay = async () => {
    if (!quote?.can_pay && !quote?.converted_order_id) return;
    setBusy(true);
    setMessage('');
    try {
      if (quote.converted_order_id) {
        navigate(`/dashboard/orders/${quote.converted_order_id}`);
        return;
      }

      const result = await convertQuote.mutateAsync({
        id: quote.id,
        payment_method: method,
      });
      const orderId = result.order_id;

      if (result.already_converted) {
        navigate(`/dashboard/orders/${orderId}`);
        return;
      }

      if (method === 'bank_transfer') {
        if (!bankRef.trim()) {
          setMessage('Enter your transfer reference.');
          setBusy(false);
          return;
        }
        await submitBank.mutateAsync({ orderId, reference: bankRef.trim() });
        navigate(`/dashboard/orders/${orderId}`);
        return;
      }

      if (method === 'wallet') {
        const amount = Math.min(walletBalance, quote.total);
        if (amount <= 0) {
          setMessage('Insufficient wallet balance.');
          setBusy(false);
          return;
        }
        const res = await payWallet.mutateAsync({ orderId, amount });
        if (res.paid) {
          navigate(`/dashboard/orders/${orderId}`);
          return;
        }
      }

      const session = await initPayment.mutateAsync(orderId);
      if (session.dev_mock) {
        await devConfirm.mutateAsync(orderId);
        navigate(`/dashboard/orders/${orderId}`);
        return;
      }
      const { default: PaystackPop } = await import('@paystack/inline-js');
      if (session.access_code) {
        const popup = new PaystackPop();
        popup.resumeTransaction(session.access_code, {
          onSuccess: () => navigate(`/dashboard/orders/${orderId}`),
          onCancel: () => setMessage('Payment cancelled — order saved.'),
          onError: () => setMessage('Payment failed.'),
        });
      }
      await refetch();
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Could not process payment.');
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return <FormPanelSkeleton />;
  }

  if (!quote) {
    return (
      <div>
        <p className="text-brand-red">Quote not found.</p>
        <Link to="/dashboard/quotes" className="mt-4 inline-block font-bold text-brand-green">
          ← Back to quotes
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <Link to="/dashboard/quotes" className="text-sm font-bold text-brand-green hover:underline">
        ← All quotes
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold">{quote.organization_name}</h1>
      <p className="text-sm text-muted">
        {quote.quote_number} · {STATUS_LABEL[quote.status] || quote.status}
      </p>

      {canPrintProforma(quote) && (quote.total > 0 || quote.subtotal > 0) && (
        <PrintExportActions
          className="mt-4"
          actions={[
            {
              label: 'Print proforma',
              onClick: () => printProforma(quote, company, { bank }),
            },
          ]}
        />
      )}

      {quote.proforma_note && (
        <div className="mt-4 rounded-xl border border-brand-green/30 bg-brand-green/5 p-4 text-sm">
          {quote.proforma_note}
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {quote.items?.map((item) => (
          <li
            key={item.id}
            className="flex gap-3 rounded-xl border border-black/8 p-3 dark:border-white/10"
          >
            <ProductImage src={item.image} alt="" className="h-14 w-14 rounded-lg object-cover" />
            <div className="min-w-0 flex-1">
              <p className="font-bold">{item.product_name}</p>
              {(item.recipient_name || item.size_label) && (
                <p className="text-xs text-brand-green">
                  {[item.recipient_name, item.size_label && `Size ${item.size_label}`].filter(Boolean).join(' · ')}
                </p>
              )}
              <p className="text-sm text-muted">Qty {item.quantity}</p>
            </div>
            <div className="text-right text-sm">
              {item.unit_price != null ? (
                <>
                  <p className="font-bold">{formatPrice(item.line_total ?? item.unit_price * item.quantity)}</p>
                  <p className="text-muted">{formatPrice(item.unit_price)} each</p>
                </>
              ) : (
                <p className="text-muted">Price TBD</p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {quote.total > 0 && (
        <dl className="mt-6 space-y-2 rounded-xl bg-black/[0.03] p-4 text-sm dark:bg-white/5">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd className="font-semibold">{formatPrice(quote.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Shipping</dt>
            <dd className="font-semibold">
              {formatPrice(quote.intl_shipping_cost + quote.local_delivery_cost)}
            </dd>
          </div>
          <div className="flex justify-between border-t border-black/10 pt-2 text-base dark:border-white/10">
            <dt className="font-bold">Total</dt>
            <dd className="font-extrabold text-brand-green">{formatPrice(quote.total)}</dd>
          </div>
          {quote.valid_until && (
            <p className="text-xs text-muted">Valid until {quote.valid_until}</p>
          )}
        </dl>
      )}

      {quote.converted_order_id && (
        <Link
          to={`/dashboard/orders/${quote.converted_order_id}`}
          className="btn-primary mt-6 inline-block"
        >
          View order
        </Link>
      )}

      {quote.can_pay && quote.status === 'proforma_sent' && (
        <div className="mt-6 rounded-2xl border border-black/8 p-5 dark:border-white/10">
          <h2 className="font-extrabold">Pay proforma</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {methods.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`rounded-lg px-3 py-2 text-xs font-bold uppercase ${method === m ? 'bg-brand-green text-white' : 'bg-black/5 dark:bg-white/10'}`}
              >
                {m.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
          {method === 'bank_transfer' && (
            <input
              className="input-field mt-3 text-sm"
              placeholder="Transfer reference"
              value={bankRef}
              onChange={(e) => setBankRef(e.target.value)}
            />
          )}
          {message && <p className="mt-3 text-sm text-brand-red">{message}</p>}
          <button type="button" onClick={pay} disabled={busy} className="btn-primary mt-4 w-full">
            {busy ? 'Processing…' : `Pay ${formatPrice(quote.total)}`}
          </button>
        </div>
      )}

      {quote.status === 'approved_pay_later' && quote.converted_order_id && (
        <p className="mt-4 rounded-xl bg-brand-gold/15 px-4 py-3 text-sm">
          Your order was approved for pay-later. Complete bank transfer from the order page.
        </p>
      )}
    </div>
  );
}
