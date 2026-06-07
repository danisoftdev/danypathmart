import { useRef, useState } from 'react';
import { useAdminShipping, useUpdateAdminShipping } from '../../hooks/admin';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminStatCard from '../../components/admin/AdminStatCard';
import { FormPanelSkeleton } from '../../components/ui/Skeleton';

export default function AdminShippingPage() {
  const { data, isLoading } = useAdminShipping();
  const update = useUpdateAdminShipping();
  const inputRef = useRef(null);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setToast('');
    const val = Number(inputRef.current?.value);
    if (Number.isNaN(val) || val < 0 || val > 100) {
      setError('Enter a percentage between 0 and 100.');
      return;
    }
    try {
      await update.mutateAsync({ local_delivery_base_percent: val });
      setToast('Shipping settings saved.');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save settings.');
    }
  };

  if (isLoading) return <FormPanelSkeleton sections={1} />;

  return (
    <div>
      <AdminPageHeader title="Shipping & rates" subtitle="Configure local delivery percentage applied at checkout." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <AdminStatCard label="Local delivery %" value={`${data?.local_delivery_base_percent ?? 0}%`} icon="🚚" tone="green" />
        <AdminStatCard label="USD → GHS rate" value={data?.usd_to_ghs_rate ?? '—'} icon="💱" tone="neutral" change="Edit in Company settings" />
      </div>

      <form key={data?.updated_at || 'default'} onSubmit={save} className="admin-panel max-w-lg">
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold">Local delivery base percent</span>
          <input
            ref={inputRef}
            type="number"
            min="0"
            max="100"
            step="0.01"
            defaultValue={data?.local_delivery_base_percent ?? 0}
            className="input-field"
          />
          <p className="mt-1 text-xs text-muted">Applied to cart subtotal for local delivery fee.</p>
        </label>
        {error && <p className="mt-3 text-sm text-brand-red">{error}</p>}
        {toast && <p className="mt-3 text-sm font-bold text-brand-green">{toast}</p>}
        <button type="submit" disabled={update.isPending} className="btn-primary mt-5">
          {update.isPending ? 'Saving…' : 'Save shipping rate'}
        </button>
      </form>
    </div>
  );
}
