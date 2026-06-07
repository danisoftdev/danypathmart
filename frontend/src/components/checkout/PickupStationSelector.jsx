import { useMemo, useState } from 'react';
import { usePickupStations } from '../../hooks/checkout';
import { formatStationAddress, stationTypeLabel } from '../../lib/orderStatus';
import { formatPrice } from '../../lib/currency';

export default function PickupStationSelector({ selectedId, onSelect, onContinue }) {
  const [regionFilter, setRegionFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');

  const { data, isLoading, isError } = usePickupStations(regionFilter || null, cityFilter || null);
  const stations = data?.data ?? [];
  const enabled = data?.enabled !== false;

  const regions = useMemo(() => {
    const set = new Set(stations.map((s) => s.region).filter(Boolean));
    return [...set].sort();
  }, [stations]);

  const cities = useMemo(() => {
    const filtered = regionFilter
      ? stations.filter((s) => s.region === regionFilter)
      : stations;
    const set = new Set(filtered.map((s) => s.city).filter(Boolean));
    return [...set].sort();
  }, [stations, regionFilter]);

  if (!enabled) {
    return (
      <p className="text-sm text-brand-red">
        Pickup stations are not available right now. Contact support or try again later.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-extrabold">Choose pickup point</h2>
        <p className="mt-1 text-sm text-muted">
          Select where you will collect your order. No home delivery — you pick up in person.
        </p>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Region</span>
          <select
            className="input-field w-full"
            value={regionFilter}
            onChange={(e) => {
              setRegionFilter(e.target.value);
              setCityFilter('');
            }}
          >
            <option value="">All regions</option>
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">City</span>
          <select
            className="input-field w-full"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
          >
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted">Loading pickup points…</p>
      ) : isError ? (
        <p className="text-sm text-brand-red">Could not load pickup stations.</p>
      ) : stations.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-muted dark:border-white/15">
          No pickup points match your filters yet. Try another region or contact us.
        </p>
      ) : (
        <ul className="space-y-2">
          {stations.map((s) => {
            const active = selectedId === s.id;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSelect(s.id)}
                  className={[
                    'w-full rounded-2xl border p-4 text-left transition',
                    active
                      ? 'border-brand-green bg-brand-green/10 ring-2 ring-brand-green/30'
                      : 'border-black/8 hover:border-brand-green/40 dark:border-white/10',
                  ].join(' ')}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold">{s.name}</p>
                      <p className="text-xs font-semibold text-muted">
                        {stationTypeLabel(s.station_type)} · {s.city}, {s.region}
                      </p>
                    </div>
                    {s.pickup_handling_fee > 0 && (
                      <span className="text-xs font-bold text-brand-green">
                        +{formatPrice(s.pickup_handling_fee)} handling
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-muted">{formatStationAddress(s)}</p>
                  {s.hours && <p className="mt-1 text-xs text-muted">Hours: {s.hours}</p>}
                  {s.phone && <p className="mt-1 text-xs font-semibold">{s.phone}</p>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-8 flex justify-end">
        <button
          type="button"
          disabled={!selectedId}
          onClick={onContinue}
          className="btn-primary min-h-[48px] px-8 disabled:opacity-50"
        >
          Continue to summary
        </button>
      </div>
    </div>
  );
}
