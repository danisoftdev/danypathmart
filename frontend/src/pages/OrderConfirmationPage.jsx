import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import ProductImage from '../components/product/ProductImage';
import CompletePaymentPanel from '../components/checkout/CompletePaymentPanel';
import PrintExportActions from '../components/ui/PrintExportActions';
import { formatPrice } from '../lib/currency';
import { isGroupOrder, printGroupRoster, printReceipt, rosterLinesFromOrder } from '../lib/orderDocuments';
import { downloadGroupRosterCsv } from '../lib/csvExport';
import { useOrder, useAirLabels, useVerifyPayment } from '../hooks/checkout';
import { useCompanyStore } from '../store/companyStore';
import { orderWhatsAppMessage, whatsAppLink } from '../lib/whatsapp';

function StatusBadge({ paid, pod }) {
  if (pod && !paid) {
    return (
      <span className="rounded-full bg-brand-gold/20 px-3 py-1 text-xs font-semibold text-amber-800">
        Pay on delivery
      </span>
    );
  }
  return (
    <span
      className={[
        'rounded-full px-3 py-1 text-xs font-semibold',
        paid ? 'bg-brand-green/10 text-brand-green' : 'bg-brand-gold/20 text-amber-700',
      ].join(' ')}
    >
      {paid ? 'Paid' : 'Awaiting payment'}
    </span>
  );
}

export default function OrderConfirmationPage() {
  const { id } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { data, isLoading, isError, refetch } = useOrder(id);
  const verifyPayment = useVerifyPayment();
  const company = useCompanyStore((s) => s.company);
  const labels = useAirLabels();
  const [verifyNote, setVerifyNote] = useState(location.state?.paymentNotice || '');
  const verifiedRef = useRef(false);

  useEffect(() => {
    if (!id || verifiedRef.current) return;
    const reference = searchParams.get('reference') || searchParams.get('trxref') || '';
    const mock = searchParams.get('mock') === '1';
    if (!reference && !mock) return;
    verifiedRef.current = true;
    (async () => {
      try {
        await verifyPayment.mutateAsync({ orderId: Number(id), reference: reference || undefined });
        setVerifyNote('Payment confirmed. Thank you!');
        await refetch();
      } catch (err) {
        const code = err.response?.data?.code;
        if (code === 'payment_pending') {
          setVerifyNote('Payment is still processing. This page will update automatically.');
        } else if (!err.response) {
          setVerifyNote('Checking payment status…');
        }
        await refetch();
      }
    })();
  }, [id, searchParams, verifyPayment, refetch]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-brand-green">
        Loading your order...
      </div>
    );
  }
  if (isError || !data?.order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Order not found</h1>
        <Link to="/shop" className="mt-4 inline-block text-brand-green hover:underline">
          Back to shop
        </Link>
      </div>
    );
  }

  const order = data.order;
  const paid = order.payment_status === 'paid';
  const isPod = order.payment_method === 'pod';
  const waUrl = order.notify_whatsapp
    ? whatsAppLink(company?.whatsapp_support, orderWhatsAppMessage(order.id))
    : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="rounded-2xl border border-black/5 bg-white p-6 dark:border-white/10 dark:bg-[#1c1c1c]">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-green/10 text-3xl text-brand-green">
            ✓
          </div>
          <h1 className="text-2xl font-bold">Thank you for your order!</h1>
          <p className="mt-1 text-black/60 dark:text-white/60">
            Order <span className="font-semibold">#{order.id}</span>
          </p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <StatusBadge paid={paid} pod={isPod} />
            <span className="text-xs capitalize text-black/50 dark:text-white/50">{order.status?.replace(/_/g, ' ')}</span>
          </div>
          {verifyNote && (
            <p className="mt-4 rounded-xl bg-brand-green/10 px-4 py-3 text-sm text-brand-green">
              {verifyNote}
            </p>
          )}
          {!paid && !isPod && (
            <p className="mt-4 rounded-xl bg-brand-gold/15 px-4 py-3 text-sm text-amber-900 dark:text-brand-gold">
              Complete payment below to start preparing your order.
            </p>
          )}
          <CompletePaymentPanel order={order} onPaid={() => refetch()} />
          <PrintExportActions
            className="mt-4 justify-center"
            actions={[
              { label: 'Print receipt', onClick: () => printReceipt(order, company) },
              ...(isGroupOrder(order)
                ? [
                    {
                      label: 'Print roster',
                      onClick: () =>
                        printGroupRoster({ organizationName: order.organization_name, order, company }),
                    },
                    {
                      label: 'Export roster CSV',
                      onClick: () =>
                        downloadGroupRosterCsv(
                          order.organization_name,
                          rosterLinesFromOrder(order),
                          order.id
                        ),
                    },
                  ]
                : []),
            ]}
          />
        </div>

        {order.has_preorder && (
          <div className="mt-6 rounded-xl bg-brand-gold/15 p-4 text-sm text-amber-800 dark:text-amber-300">
            {labels.orderNotice} Estimated arrival dates are shown per item below.
          </div>
        )}

        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Items
          </h2>
          <ul className="space-y-3">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3">
                <ProductImage
                  src={item.image}
                  alt={item.name}
                  className="h-14 w-14 flex-shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-black/60 dark:text-white/60">
                    {item.quantity} × {formatPrice(item.unit_price)}
                    {item.is_preorder && item.estimated_arrival && (
                      <span className="ml-2 text-brand-gold">ETA {item.estimated_arrival}</span>
                    )}
                  </p>
                </div>
                <span className="text-sm font-semibold">{formatPrice(item.line_total)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 space-y-2 border-t border-black/10 pt-4 dark:border-white/10">
          <div className="flex justify-between text-sm">
            <span className="text-black/60 dark:text-white/60">Subtotal</span>
            <span>{formatPrice(order.subtotal)}</span>
          </div>
          {order.intl_shipping_cost > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-black/60 dark:text-white/60">{labels.intlShippingTitle}</span>
              <span>{formatPrice(order.intl_shipping_cost)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-black/60 dark:text-white/60">{labels.localDeliveryTitle}</span>
            <span>{formatPrice(order.local_delivery_cost)}</span>
          </div>
          {(order.wallet_paid || 0) > 0 && (
            <div className="flex justify-between text-sm text-brand-green">
              <span>Wallet applied</span>
              <span>-{formatPrice(order.wallet_paid)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-black/10 pt-2 text-base font-bold dark:border-white/10">
            <span>{paid ? 'Total paid' : 'Total due'}</span>
            <span className="text-brand-green">
              {formatPrice(paid ? order.total : (order.amount_due ?? order.total))}
            </span>
          </div>
        </div>

        {order.address && (
          <div className="mt-6 rounded-xl border border-black/10 p-4 text-sm dark:border-white/15">
            <p className="font-medium">{order.address.recipient_name}</p>
            <p className="text-black/60 dark:text-white/60">
              {order.address.street}, {order.address.city}, {order.address.region}
              {order.address.landmark ? ` (${order.address.landmark})` : ''}
            </p>
            <p className="text-black/60 dark:text-white/60">{order.address.phone}</p>
          </div>
        )}

        {waUrl && (
          <div className="mt-6 rounded-xl border border-brand-green/30 bg-brand-green/5 p-4">
            <p className="text-sm font-bold text-brand-green">WhatsApp updates</p>
            <p className="mt-1 text-xs text-muted">
              Tap below to open WhatsApp with your order reference — no extra login required.
            </p>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary mt-3 inline-flex w-full items-center justify-center gap-2 py-2.5 text-sm"
            >
              Open WhatsApp
            </a>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            to={`/dashboard/orders/${order.id}`}
            className="flex-1 rounded-lg bg-brand-green px-4 py-3 text-center font-semibold text-white transition hover:bg-opacity-90"
          >
            Track Order
          </Link>
          <Link
            to="/shop"
            className="flex-1 rounded-lg border border-black/15 px-4 py-3 text-center font-medium dark:border-white/15"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
