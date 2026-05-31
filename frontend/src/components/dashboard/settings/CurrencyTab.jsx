import { useState } from 'react';
import { useAuthStore } from '../../../store/authStore';
import { useCurrencies, useSetCurrency } from '../../../hooks/account';

const META = {
  GHS: { flag: '\u{1F1EC}\u{1F1ED}', name: 'Ghana Cedi' },
  USD: { flag: '\u{1F1FA}\u{1F1F8}', name: 'US Dollar' },
  EUR: { flag: '\u{1F1EA}\u{1F1FA}', name: 'Euro' },
  GBP: { flag: '\u{1F1EC}\u{1F1E7}', name: 'British Pound' },
  NGN: { flag: '\u{1F1F3}\u{1F1EC}', name: 'Nigerian Naira' },
};
const ORDER = ['GHS', 'USD', 'EUR', 'GBP', 'NGN'];

export default function CurrencyTab() {
  const user = useAuthStore((s) => s.user);
  const { data: currencies, isLoading } = useCurrencies();
  const setCurrency = useSetCurrency();
  const [selected, setSelected] = useState(user?.preferred_currency || 'GHS');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const rates = {};
  (currencies || []).forEach((c) => {
    rates[c.code] = c.rate_to_ghs;
  });

  const available = ORDER.filter((code) => rates[code] !== undefined || code === 'GHS');

  const save = async () => {
    setErr('');
    setMsg('');
    try {
      await setCurrency.mutateAsync(selected);
      setMsg('Currency preference saved.');
    } catch (e) {
      setErr(e.response?.data?.message || 'Could not save your currency.');
    }
  };

  return (
    <div className="card-panel max-w-xl">
      <h3 className="text-sm font-semibold">Display currency</h3>
      <p className="mt-0.5 text-xs text-black/50 dark:text-white/50">
        Choose the currency you would like prices shown in.
      </p>

      {isLoading ? (
        <p className="mt-4 text-sm text-black/50 dark:text-white/50">Loading rates...</p>
      ) : (
        <div className="mt-4 space-y-2">
          {available.map((code) => {
            const rate = rates[code];
            return (
              <label
                key={code}
                className={[
                  'flex cursor-pointer items-center justify-between rounded-xl border p-3 transition',
                  selected === code
                    ? 'border-brand-green ring-1 ring-brand-green'
                    : 'border-black/10 dark:border-white/15',
                ].join(' ')}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="currency"
                    checked={selected === code}
                    onChange={() => setSelected(code)}
                    className="accent-brand-green"
                  />
                  <span className="text-xl">{META[code]?.flag}</span>
                  <span>
                    <span className="block text-sm font-medium">{code}</span>
                    <span className="block text-xs text-black/50 dark:text-white/50">{META[code]?.name}</span>
                  </span>
                </span>
                <span className="text-xs text-black/50 dark:text-white/50">
                  {code === 'GHS' ? 'Base currency' : rate ? `1 ${code} = ${rate} GHS` : ''}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {err && <p className="mt-3 text-sm text-brand-red">{err}</p>}
      {msg && <p className="mt-3 text-sm text-brand-green">{msg}</p>}

      <button type="button" onClick={save} className="btn-primary mt-5" disabled={setCurrency.isPending}>
        {setCurrency.isPending ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
}
