import { useState } from 'react';
import { GHANA_REGIONS } from '../../../lib/ghana';

const EMPTY = {
  recipient_name: '',
  phone: '',
  region: '',
  city: '',
  street: '',
  landmark: '',
  is_default: false,
};

export default function AddressForm({ initial, onSubmit, submitting }) {
  const [form, setForm] = useState({ ...EMPTY, ...(initial || {}) });
  const [error, setError] = useState('');

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const required = ['recipient_name', 'phone', 'region', 'city', 'street'];
    if (required.some((k) => !String(form[k] || '').trim())) {
      setError('Please fill in all required fields.');
      return;
    }
    try {
      await onSubmit(form);
    } catch (e2) {
      setError(e2.response?.data?.message || 'Could not save the address.');
    }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label className="mb-1 block text-xs text-black/60 dark:text-white/60">Recipient name</label>
        <input className="modal-input" value={form.recipient_name} onChange={(e) => update('recipient_name', e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-black/60 dark:text-white/60">Phone</label>
        <input className="modal-input" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-black/60 dark:text-white/60">Region</label>
        <select className="modal-input" value={form.region} onChange={(e) => update('region', e.target.value)}>
          <option value="">Select region</option>
          {GHANA_REGIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-black/60 dark:text-white/60">City / Town</label>
        <input className="modal-input" value={form.city} onChange={(e) => update('city', e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs text-black/60 dark:text-white/60">Street address</label>
        <input className="modal-input" value={form.street} onChange={(e) => update('street', e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs text-black/60 dark:text-white/60">Landmark (optional)</label>
        <input className="modal-input" value={form.landmark || ''} onChange={(e) => update('landmark', e.target.value)} />
      </div>

      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          checked={!!form.is_default}
          onChange={(e) => update('is_default', e.target.checked)}
          className="accent-brand-green"
        />
        Set as default address
      </label>

      {error && <p className="text-sm text-brand-red sm:col-span-2">{error}</p>}

      <div className="sm:col-span-2">
        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? 'Saving...' : 'Save address'}
        </button>
      </div>
    </form>
  );
}
