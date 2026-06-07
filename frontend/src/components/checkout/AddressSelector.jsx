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
      <div className="mb-6">
        <h2 className="text-xl font-extrabold">Delivery address</h2>
        <p className="mt-1 text-sm text-muted">Choose where we should deliver your order.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-black/5 dark:bg-white/5" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((addr) => {
            const selected = selectedId === addr.id;
            return (
              <button
                key={addr.id}
                type="button"
                onClick={() => onSelect(addr.id)}
                className={[
                  'flex w-full items-start gap-4 rounded-2xl border-2 p-4 text-left transition',
                  selected
                    ? 'border-brand-green bg-brand-green/5 shadow-sm ring-2 ring-brand-green/20'
                    : 'border-black/8 bg-white hover:border-brand-green/40 dark:border-white/10 dark:bg-[#1E1E1E]',
                ].join(' ')}
              >
                <span
                  className={[
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                    selected ? 'border-brand-green bg-brand-green text-white' : 'border-black/20 dark:border-white/30',
                  ].join(' ')}
                >
                  {selected && <span className="text-[10px]">✓</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{addr.recipient_name}</span>
                    {addr.is_default && (
                      <span className="rounded-full bg-brand-green/15 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-green">
                        Default
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-sm text-muted">
                    {addr.street}, {addr.city}, {addr.region}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">
                    {addr.phone}
                    {addr.landmark ? ` · ${addr.landmark}` : ''}
                  </span>
                </span>
              </button>
            );
          })}

          {addresses.length === 0 && !adding && (
            <div className="rounded-2xl border border-dashed border-brand-green/40 bg-brand-green/5 p-6 text-center">
              <p className="font-semibold text-brand-green">No saved addresses yet</p>
              <p className="mt-1 text-sm text-muted">Add your delivery address to continue.</p>
            </div>
          )}
        </div>
      )}

      {adding ? (
        <form
          onSubmit={submitNew}
          className="mt-5 grid grid-cols-1 gap-4 rounded-2xl border border-black/8 bg-black/[0.02] p-5 sm:grid-cols-2 dark:border-white/10 dark:bg-white/[0.02]"
        >
          <p className="text-sm font-bold sm:col-span-2">New address</p>
          {FIELDS.map((f) => (
            <div key={f.key} className={f.full ? 'sm:col-span-2' : ''}>
              <label className="mb-1.5 block text-xs font-semibold text-muted">{f.label}</label>
              <input
                type="text"
                value={form[f.key]}
                onChange={(e) => update(f.key, e.target.value)}
                className="input-field min-h-[44px] text-sm"
              />
            </div>
          ))}
          <label className="flex min-h-[44px] items-center gap-2 text-sm font-medium sm:col-span-2">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => update('is_default', e.target.checked)}
              className="h-4 w-4 accent-brand-green"
            />
            Set as default address
          </label>
          {error && <p className="text-sm text-brand-red sm:col-span-2">{error}</p>}
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button type="submit" disabled={addAddress.isPending} className="btn-primary min-h-[44px] px-6">
              {addAddress.isPending ? 'Saving…' : 'Save address'}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setError('');
              }}
              className="min-h-[44px] rounded-xl border-2 border-black/10 px-6 font-semibold dark:border-white/15"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-green/50 font-bold text-brand-green transition hover:bg-brand-green/5"
        >
          + Add new address
        </button>
      )}

      <div className="mt-8 flex justify-end">
        <button
          type="button"
          disabled={!selectedId}
          onClick={onContinue}
          className="btn-primary min-h-[48px] w-full px-8 sm:w-auto"
        >
          Continue to summary
        </button>
      </div>
    </div>
  );
}
