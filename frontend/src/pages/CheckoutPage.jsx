import { lazy, Suspense, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import CheckoutStepper from '../components/checkout/CheckoutStepper';
import AddressSelector from '../components/checkout/AddressSelector';
import PickupStationSelector from '../components/checkout/PickupStationSelector';
import OrderSummary from '../components/checkout/OrderSummary';
import { useAddresses, usePlatformFeatures, usePickupStations, useShippingQuote } from '../hooks/checkout';
import { formatPrice } from '../lib/currency';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';

const PaymentStep = lazy(() => import('../components/checkout/PaymentStep'));

function PaymentStepFallback() {
  return (
    <div className="space-y-4 py-4">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-black/5 dark:bg-white/10" />
      <div className="h-32 animate-pulse rounded-2xl bg-black/5 dark:bg-white/10" />
      <div className="h-48 animate-pulse rounded-2xl bg-black/5 dark:bg-white/10" />
    </div>
  );
}

export default function CheckoutPage() {
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const items = useCartStore((s) => s.items);
  const { pickupStationsEnabled, isLoading: flagsLoading } = usePlatformFeatures();

  const [step, setStep] = useState(1);
  const [pickedAddress, setPickedAddress] = useState(null);
  const [pickedStation, setPickedStation] = useState(null);

  const { data: addrData } = useAddresses(isAuthenticated && !pickupStationsEnabled);
  const addresses = addrData?.data ?? [];
  const defaultId = addresses.find((a) => a.is_default)?.id ?? addresses[0]?.id ?? null;
  const selectedAddressId = pickedAddress ?? defaultId;
  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);

  const { data: stationsData } = usePickupStations(null, null);
  const selectedStation = (stationsData?.data ?? []).find((s) => s.id === pickedStation);

  const quoteItems = useMemo(
    () => items.map((i) => ({ product_id: i.id, quantity: i.qty })),
    [items]
  );

  const quoteRegion = pickupStationsEnabled
    ? selectedStation?.region ?? null
    : selectedAddress?.region ?? null;

  const { data: quote, isLoading: quoteLoading } = useShippingQuote(
    quoteItems,
    items.length > 0,
    quoteRegion,
    null,
    pickupStationsEnabled ? pickedStation : null
  );

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (items.length === 0) {
    return <Navigate to="/cart" replace />;
  }

  if (flagsLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-muted">Loading checkout…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-28 md:py-10 md:pb-10">
      <div className="mb-2 text-center md:text-left">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Checkout</h1>
        <p className="mt-1 text-sm text-muted">
          {pickupStationsEnabled
            ? 'Choose your pickup point and pay — collect in person at the station.'
            : 'Fast, secure checkout in three simple steps.'}
        </p>
      </div>

      <CheckoutStepper current={step} pickupMode={pickupStationsEnabled} />

      <div className="rounded-2xl border border-black/8 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#1E1E1E] sm:p-8">
        {step === 1 && pickupStationsEnabled && (
          <PickupStationSelector
            selectedId={pickedStation}
            onSelect={setPickedStation}
            onContinue={() => setStep(2)}
          />
        )}

        {step === 1 && !pickupStationsEnabled && (
          <AddressSelector
            selectedId={selectedAddressId}
            onSelect={setPickedAddress}
            onContinue={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <OrderSummary
            items={items}
            quote={quote}
            isLoading={quoteLoading}
            pickupMode={pickupStationsEnabled}
            pickupStation={selectedStation}
            onBack={() => setStep(1)}
            onContinue={() => setStep(3)}
          />
        )}

        {step === 3 && (
          <Suspense fallback={<PaymentStepFallback />}>
            <PaymentStep
              items={quoteItems}
              addressId={pickupStationsEnabled ? undefined : selectedAddressId}
              pickupStationId={pickupStationsEnabled ? pickedStation : undefined}
              quote={quote}
              pickupMode={pickupStationsEnabled}
              onBack={() => setStep(2)}
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
