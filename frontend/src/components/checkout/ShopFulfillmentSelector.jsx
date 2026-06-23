import { useState } from 'react';
import LocationMapView from '../map/LocationMapView';

/** Shop-only checkout: delivery to address vs pick up at seller location. */
export default function ShopFulfillmentSelector({
  quote,
  selectedMode,
  onSelect,
}) {
  const pickup = quote?.shop_pickup;
  const available = quote?.shop_pickup_available;

  if (!available || !pickup) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-extrabold">How do you want your order?</h2>
        <p className="mt-1 text-sm text-muted">
          This cart is from one shop. Choose delivery to your address or collect in person.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onSelect('delivery')}
          className={`rounded-2xl border p-4 text-left transition ${
            selectedMode === 'delivery'
              ? 'border-brand-green bg-brand-green/10 ring-2 ring-brand-green/30'
              : 'border-black/10 hover:border-brand-green/40 dark:border-white/10'
          }`}
        >
          <p className="font-bold">Delivery to my address</p>
          <p className="mt-1 text-xs text-muted">Seller delivers — fee arranged directly with them.</p>
        </button>
        <button
          type="button"
          onClick={() => onSelect('shop_pickup')}
          className={`rounded-2xl border p-4 text-left transition ${
            selectedMode === 'shop_pickup'
              ? 'border-brand-green bg-brand-green/10 ring-2 ring-brand-green/30'
              : 'border-black/10 hover:border-brand-green/40 dark:border-white/10'
          }`}
        >
          <p className="font-bold">Pick up at shop</p>
          <p className="mt-1 text-xs text-muted">Collect at {pickup.shop_name || 'the seller'} — no address needed.</p>
        </button>
      </div>

      {selectedMode === 'shop_pickup' && (
        <LocationMapView
          latitude={pickup.latitude}
          longitude={pickup.longitude}
          streetAddress={pickup.street_address}
          city={pickup.city}
          region={pickup.region}
          directionsUrl={pickup.directions_url}
          label={pickup.shop_name}
          height={220}
        />
      )}

    </div>
  );
}