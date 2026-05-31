import { useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import CheckoutStepper from '../components/checkout/CheckoutStepper';
import AddressSelector from '../components/checkout/AddressSelector';
import OrderSummary from '../components/checkout/OrderSummary';
import PaymentStep from '../components/checkout/PaymentStep';
import { useAddresses, useShippingQuote } from '../hooks/checkout';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';

export default function CheckoutPage() {
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const items = useCartStore((s) => s.items);

  const [step, setStep] = useState(1);
  const [picked, setPicked] = useState(null);

  const { data: addrData } = useAddresses(isAuthenticated);
  const addresses = addrData?.data ?? [];
  const defaultId = addresses.find((a) => a.is_default)?.id ?? addresses[0]?.id ?? null;
  const selectedId = picked ?? defaultId;

  const quoteItems = useMemo(
    () => items.map((i) => ({ product_id: i.id, quantity: i.qty })),
    [items]
  );
  const { data: quote, isLoading: quoteLoading } = useShippingQuote(quoteItems, items.length > 0);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (items.length === 0) {
    return <Navigate to="/cart" replace />;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-center text-2xl font-bold">Checkout</h1>
      <CheckoutStepper current={step} />

      <div className="rounded-2xl border border-black/5 bg-white p-6 dark:border-white/10 dark:bg-[#1c1c1c]">
        {step === 1 && (
          <AddressSelector
            selectedId={selectedId}
            onSelect={setPicked}
            onContinue={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <OrderSummary
            items={items}
            quote={quote}
            isLoading={quoteLoading}
            onBack={() => setStep(1)}
            onContinue={() => setStep(3)}
          />
        )}

        {step === 3 && (
          <PaymentStep
            items={quoteItems}
            addressId={selectedId}
            quote={quote}
            onBack={() => setStep(2)}
          />
        )}
      </div>
    </div>
  );
}
