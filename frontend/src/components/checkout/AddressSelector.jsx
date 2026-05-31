import { useState } from 'react';
import { useAddAddress, useAddresses } from '../../hooks/checkout';

const EMPTY = {
  recipient_name: '',
  phone: '',
  region: '',
  city: '',
  street: '',
  landmark: '',
  is_default: false,
};

const FIELDS = [
  { key: 'recipient_name', label: 'Recipient name', required: true },
  { key: 'phone', label: 'Phone', required: true },
  { key: 'region', label: 'Region', required: true },
  { key: 'city', label: 'City', required: true },
  { key: 'street', label: 'Street address', required: true, full: true },
  { key: 'landmark', label: 'Landmark (optional)', required: false, full: true },
];

export default function AddressSelector({ selectedId, onSelect, onContinue }) {
  const { data, isLoading } = useAddresses();
  const addAddress = useAddAddress();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  const addresses = data?.data ?? [];

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submitNew(e) {
    e.preventDefault();
    setError('');
    const missing = FIELDS.filter((f) => f.required && !form[f.key].trim());
    if (missing.length > 0) {
      setError('Please fill in all required fields.');
      return;
    }
    try {
      const res = await addAddress.mutateAsync(form);
      setAdding(false);
      setForm(EMPTY);
      onSelect(res.id);
    } catch {
      setError('Could not save the address. Please try again.');
    }
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Delivery address</h2>

      {isLoading ? (
        <p className="text-sm text-black/60 dark:text-white/60">Loading addresses...</p>
      ) : (
        <div className="space-y-3">
          {addresses.map((addr) => (
            <label
              key={addr.id}
              className={[
                'flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition',
                selectedId === addr.id
                  ? 'border-brand-green ring-1 ring-brand-green'
                  : 'border-black/10 dark:border-white/15',
              ].join(' ')}
            >
              <input
                type="radio"
                name="address"
                checked={selectedId === addr.id}
                onChange={() => onSelect(addr.id)}
                className="mt-1 accent-brand-green"
              />
              <span className="text-sm">
                <span className="font-medium">{addr.recipient_name}</span>
                {addr.is_default && (
                  <span className="ml-2 rounded-full bg-brand-green/10 px-2 py-0.5 text-xs text-brand-green">
                    Default
                  </span>
                )}
                <span className="mt-1 block text-black/60 dark:text-white/60">
                  {addr.street}, {addr.city}, {addr.region} &middot; {addr.phone}
                  {addr.landmark ? ` (${addr.landmark})` : ''}
                </span>
              </span>
            </label>
          ))}

          {addresses.length === 0 && !adding && (
            <p className="text-sm text-black/60 dark:text-white/60">
              No saved addresses yet. Add one to continue.
            </p>
          )}
        </div>
      )}

      {adding ? (
        <form
          onSubmit={submitNew}
          className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-black/10 p-4 sm:grid-cols-2 dark:border-white/15"
        >
          {FIELDS.map((f) => (
            <div key={f.key} className={f.full ? 'sm:col-span-2' : ''}>
              <label className="mb-1 block text-xs text-black/60 dark:text-white/60">
                {f.label}
              </label>
              <input
                type="text"
                value={form[f.key]}
                onChange={(e) => update(f.key, e.target.value)}
                className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-brand-green dark:border-white/15 dark:bg-[#111]"
              />
            </div>
          ))}
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => update('is_default', e.target.checked)}
              className="accent-brand-green"
            />
            Set as default address
          </label>
          {error && <p className="text-sm text-red-500 sm:col-span-2">{error}</p>}
          <div className="flex gap-3 sm:col-span-2">
            <button
              type="submit"
              disabled={addAddress.isPending}
              className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white transition hover:bg-opacity-90 disabled:opacity-50"
            >
              {addAddress.isPending ? 'Saving...' : 'Save address'}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setError('');
              }}
              className="rounded-lg border border-black/15 px-4 py-2 text-sm dark:border-white/15"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-4 rounded-lg border border-dashed border-brand-green px-4 py-2 text-sm font-medium text-brand-green"
        >
          + Add new address
        </button>
      )}

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          disabled={!selectedId}
          onClick={onContinue}
          className="rounded-lg bg-brand-green px-6 py-2.5 font-semibold text-white transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue to summary
        </button>
      </div>
    </div>
  );
}
