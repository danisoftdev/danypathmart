import { lazy, Suspense, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import CheckoutStepper from '../components/checkout/CheckoutStepper';
import AddressSelector from '../components/checkout/AddressSelector';
import PickupStationSelector from '../components/checkout/PickupStationSelector';
import ShopFulfillmentSelector from '../components/checkout/ShopFulfillmentSelector';
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

  const shopOnly = useMemo(() => items.length > 0 && items.every((i) => i.shop_id), [items]);
  const hasShopItems = useMemo(() => items.some((i) => i.shop_id), [items]);
  const pickupMode = pickupStationsEnabled && !hasShopItems;

  const [step, setStep] = useState(1);
  const [pickedAddress, setPickedAddress] = useState(null);
  const [pickedStation, setPickedStation] = useState(null);
  const [shopFulfillmentMode, setShopFulfillmentMode] = useState('delivery');

  const { data: addrData } = useAddresses(isAuthenticated && (!pickupMode || hasShopItems));
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

  const shopPickupMode = shopOnly && shopFulfillmentMode === 'shop_pickup';
  const needsAddress = !pickupMode && !shopPickupMode;

  const quoteRegion = pickupMode
    ? selectedStation?.region ?? null
    : selectedAddress?.region ?? null;

  const { data: quote, isLoading: quoteLoading } = useShippingQuote(
    quoteItems,
    items.length > 0,
    quoteRegion,
    null,
    pickupMode ? pickedStation : null,
    shopOnly ? shopFulfillmentMode : null
  );

  const shopPickupAvailable = shopOnly && quote?.shop_pickup_available;

  const continueFromStep1 = () => {
    if (shopPickupAvailable && shopFulfillmentMode === 'shop_pickup') {
      setStep(2);
      return;
    }
    if (needsAddress && !selectedAddressId) return;
    setStep(2);
  };

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
          {pickupMode
            ? 'Choose your pickup point and pay — collect in person at the station.'
            : shopPickupMode
              ? 'Pay in the app, then collect your order at the shop.'
              : hasShopItems
                ? 'Delivery address required for marketplace items — or pick up at the shop when available.'
                : 'Fast, secure checkout in three simple steps.'}
        </p>
      </div>

      {hasShopItems && !shopPickupMode && (
        <div className="mb-4 rounded-2xl border border-brand-gold/40 bg-brand-gold/10 px-4 py-3 text-sm">
          <p className="font-bold">Marketplace items in your cart</p>
          <p className="mt-1 text-muted">
            {quote?.shop_delivery_note ||
              'Shop sellers deliver to your address. Delivery fees are arranged directly with each seller — not charged here.'}
            {pickupStationsEnabled && !shopOnly && ' DPM pickup stations apply only to catalog items.'}
          </p>
        </div>
      )}

      <CheckoutStepper current={step} pickupMode={pickupMode} />

      <div className="rounded-2xl border border-black/8 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#1E1E1E] sm:p-8">
        {step === 1 && pickupMode && (
          <PickupStationSelector
            selectedId={pickedStation}
            onSelect={setPickedStation}
            onContinue={() => setStep(2)}
          />
        )}

        {step === 1 && !pickupMode && shopPickupAvailable && (
          <div className="space-y-6">
            <ShopFulfillmentSelector
              quote={quote}
              selectedMode={shopFulfillmentMode}
              onSelect={setShopFulfillmentMode}
            />
            {shopFulfillmentMode === 'delivery' && (
              <div className="border-t border-black/8 pt-6 dark:border-white/10">
                <AddressSelector
                  selectedId={selectedAddressId}
                  onSelect={setPickedAddress}
                  hideContinue
                />
              </div>
            )}
            <button
              type="button"
              className="btn-primary mt-6 min-h-[44px] w-full sm:w-auto"
              disabled={!shopFulfillmentMode || (shopFulfillmentMode === 'delivery' && !selectedAddressId)}
              onClick={continueFromStep1}
            >
              Continue
            </button>
          </div>
        )}

        {step === 1 && !pickupMode && !shopPickupAvailable && (
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
            pickupMode={pickupMode}
            shopPickupMode={shopPickupMode}
            pickupStation={selectedStation}
            shopPickup={quote?.shop_pickup}
            onBack={() => setStep(1)}
            onContinue={() => setStep(3)}
          />
        )}

        {step === 3 && (
          <Suspense fallback={<PaymentStepFallback />}>
            <PaymentStep
              items={quoteItems}
              addressId={needsAddress ? selectedAddressId : undefined}
              pickupStationId={pickupMode ? pickedStation : undefined}
              shopFulfillmentMode={shopOnly ? shopFulfillmentMode : undefined}
              quote={quote}
              pickupMode={pickupMode}
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
