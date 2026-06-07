import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import CheckoutStepper from '../components/checkout/CheckoutStepper';
import AddressSelector from '../components/checkout/AddressSelector';
import OrderSummary from '../components/checkout/OrderSummary';
import { useAddresses, useShippingQuote } from '../hooks/checkout';
import { formatPrice } from '../lib/currency';
import { useAuthStore } from '../store/authStore';
import { useGroupOrderStore } from '../store/groupOrderStore';

const PaymentStep = lazy(() => import('../components/checkout/GroupPaymentStep'));

function PaymentStepFallback() {
  return (
    <div className="space-y-4 py-4">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-black/5 dark:bg-white/10" />
      <div className="h-32 animate-pulse rounded-2xl bg-black/5 dark:bg-white/10" />
    </div>
  );
}

export default function GroupCheckoutPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const referralFromUrl = searchParams.get('ref') || '';
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const organizationName = useGroupOrderStore((s) => s.organizationName);
  const lines = useGroupOrderStore((s) => s.lines);
  const clearGroup = useGroupOrderStore((s) => s.clear);

  const [step, setStep] = useState(1);
  const [picked, setPicked] = useState(null);

  const { data: addrData } = useAddresses(isAuthenticated);
  const addresses = addrData?.data ?? [];
  const defaultId = addresses.find((a) => a.is_default)?.id ?? addresses[0]?.id ?? null;
  const selectedId = picked ?? defaultId;

  const quoteItems = useMemo(
    () =>
      lines.map((line) => ({
        product_id: line.product_id,
        quantity: line.quantity,
        recipient_name: line.recipient_name,
        size_label: line.size_label,
      })),
    [lines]
  );

  const summaryItems = useMemo(
    () =>
      lines.map((line) => ({
        id: line.product_id,
        name: line.name,
        price: line.price,
        qty: line.quantity,
        recipient_name: line.recipient_name,
        size_label: line.size_label,
      })),
    [lines]
  );

  const { data: quote, isLoading: quoteLoading } = useShippingQuote(
    quoteItems,
    lines.length > 0,
    null,
    { order_type: 'group', organization_name: organizationName }
  );

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (lines.length === 0 || !organizationName.trim()) {
    return <Navigate to="/group-order" replace />;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-28 md:py-10 md:pb-10">
      <div className="mb-2">
        <Link to="/group-order" className="text-sm font-bold text-brand-green hover:underline">
          ← Back to group order
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Group checkout</h1>
        <p className="mt-1 text-sm text-muted">
          {organizationName} · {lines.length} line{lines.length === 1 ? '' : 's'}
        </p>
      </div>

      <CheckoutStepper current={step} />

      <div className="rounded-2xl border border-black/8 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#1E1E1E] sm:p-8">
        {step === 1 && (
          <AddressSelector
            selectedId={selectedId}
            onSelect={setPicked}
            onContinue={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <OrderSummary
            items={summaryItems}
            quote={quote}
            isLoading={quoteLoading}
            onBack={() => setStep(1)}
            onContinue={() => setStep(3)}
            groupOrder
          />
        )}

        {step === 3 && (
          <Suspense fallback={<PaymentStepFallback />}>
            <PaymentStep
              items={quoteItems}
              addressId={selectedId}
              quote={quote}
              organizationName={organizationName}
              referralCode={referralFromUrl}
              onBack={() => setStep(2)}
              onComplete={clearGroup}
            />
          </Suspense>
        )}
      </div>

      {quote && step >= 2 && (
        <div className="fixed inset-x-0 bottom-16 z-40 border-t border-black/10 bg-white/95 p-3 backdrop-blur-md dark:border-white/10 dark:bg-[#121212]/95 md:hidden">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted">Total</p>
              <p className="text-xl font-extrabold text-brand-green">{formatPrice(quote.total)}</p>
            </div>
            <p className="text-xs font-bold text-muted">Step {step} of 3</p>
          </div>
        </div>
      )}
    </div>
  );
}
