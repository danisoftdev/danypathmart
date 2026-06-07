import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  useAdminPickupStations,
  useCreatePickupStation,
  useDeletePickupStation,
  useUpdatePickupStation,
} from '../../hooks/admin';
import { useAuthStore } from '../../store/authStore';
import { hasAnyPermission } from '../../lib/permissions';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminPageAlert from '../../components/admin/AdminPageAlert';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import { AdminTableSkeleton } from '../../components/ui/Skeleton';
import { STATION_TYPES, formatStationAddress, stationTypeLabel } from '../../lib/orderStatus';
import { formatPrice } from '../../lib/currency';

const EMPTY = {
  name: '',
  slug: '',
  station_type: 'owned',
  region: '',
  city: '',
  street_address: '',
  landmark: '',
  phone: '',
  hours: '',
  latitude: '',
  longitude: '',
  pickup_handling_fee: 0,
  is_active: true,
};

function StationModal({ station, onClose, onSave, loading }) {
  const [form, setForm] = useState(station ? { ...EMPTY, ...station, is_active: !!station.is_active } : EMPTY);
  const set = (key) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: val }));
  };

  const submit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      pickup_handling_fee: Number(form.pickup_handling_fee) || 0,
      latitude: form.latitude === '' ? null : Number(form.latitude),
      longitude: form.longitude === '' ? null : Number(form.longitude),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !loading && onClose()}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 dark:bg-[#1E1E1E]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-extrabold">{station ? 'Edit pickup station' : 'Add pickup station'}</h2>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Name</span>
            <input className="input-field w-full" value={form.name} onChange={set('name')} required />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Type</span>
            <select className="input-field w-full" value={form.station_type} onChange={set('station_type')}>
              {STATION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">Region</span>
              <input className="input-field w-full" value={form.region} onChange={set('region')} required />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">City</span>
              <input className="input-field w-full" value={form.city} onChange={set('city')} required />
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Street address</span>
            <input className="input-field w-full" value={form.street_address} onChange={set('street_address')} required />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Landmark (optional)</span>
            <input className="input-field w-full" value={form.landmark} onChange={set('landmark')} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Phone</span>
            <input className="input-field w-full" value={form.phone} onChange={set('phone')} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Opening hours</span>
            <textarea className="input-field w-full" rows={2} value={form.hours} onChange={set('hours')} placeholder="Mon–Sat 9am–6pm" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Pickup handling fee (GHS)</span>
            <input type="number" min="0" step="0.01" className="input-field w-full" value={form.pickup_handling_fee} onChange={set('pickup_handling_fee')} />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={!!form.is_active} onChange={set('is_active')} className="h-4 w-4 accent-brand-green" />
            Active (visible at checkout)
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={loading} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminPickupStationsPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = hasAnyPermission(user, ['manage_pickup_stations', 'edit_company_settings']);
  const { data = [], isLoading } = useAdminPickupStations(canManage);
  const create = useCreatePickupStation();
  const update = useUpdatePickupStation();
  const remove = useDeletePickupStation();

  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pageError, setPageError] = useState('');

  if (user && !canManage) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const save = async (payload) => {
    setPageError('');
    try {
      if (modal?.id) {
        await update.mutateAsync({ id: modal.id, ...payload });
      } else {
        await create.mutateAsync(payload);
      }
      setModal(null);
    } catch (err) {
      setPageError(err.response?.data?.message || 'Could not save pickup station.');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setPageError('');
    try {
      await remove.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setPageError(err.response?.data?.message || 'Could not delete station.');
      setDeleteTarget(null);
    }
  };

  const busy = create.isPending || update.isPending;

  return (
    <div>
      <AdminPageHeader
        title="Pickup stations"
        subtitle="Manage collection points — customers choose one at checkout when Pickup stations is enabled."
        actions={
          <button type="button" onClick={() => setModal({})} className="btn-primary px-4 py-2 text-sm">
            Add station
          </button>
        }
      />

      <AdminPageAlert message={pageError} onDismiss={() => setPageError('')} />

      {isLoading ? (
        <AdminTableSkeleton rows={4} cols={3} />
      ) : data.length === 0 ? (
        <p className="admin-panel text-sm text-muted">
          No pickup stations yet. Add your first collection point, then enable <strong>Pickup stations</strong> in Company Settings.
        </p>
      ) : (
        <ul className="space-y-2">
          {data.map((s) => (
            <li key={s.id} className="admin-panel flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold">{s.name}</p>
                  {!s.is_active && (
                    <span className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-bold dark:bg-white/10">INACTIVE</span>
                  )}
                </div>
                <p className="text-xs font-semibold text-muted">
                  {stationTypeLabel(s.station_type)} · {s.city}, {s.region}
                </p>
                <p className="mt-1 text-sm text-muted">{formatStationAddress(s)}</p>
                {s.pickup_handling_fee > 0 && (
                  <p className="mt-1 text-xs font-bold text-brand-green">Handling fee: {formatPrice(s.pickup_handling_fee)}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => setModal(s)} className="btn-ghost px-3 py-1.5 text-sm">Edit</button>
                <button type="button" onClick={() => setDeleteTarget(s)} className="text-sm font-bold text-brand-red hover:underline">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modal && (
        <StationModal
          station={modal.id ? modal : null}
          onClose={() => setModal(null)}
          onSave={save}
          loading={busy}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete pickup station?"
        message={deleteTarget ? `Delete "${deleteTarget.name}"? Stations linked to orders cannot be deleted.` : ''}
        confirmLabel="Delete"
        loading={remove.isPending}
      />
    </div>
  );
}
