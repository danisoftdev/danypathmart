import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  useAdminDeliveryRun,
  useAdminDeliveryRuns,
  useAdminDrivers,
  useAdminHubQueue,
  useCreateDeliveryRun,
  useCreateDriverAccount,
  useDeleteDriverAccount,
  useDispatchDeliveryRun,
} from '../../hooks/admin';
import { useAuthStore } from '../../store/authStore';
import { hasAnyPermission } from '../../lib/permissions';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminPageAlert from '../../components/admin/AdminPageAlert';
import PromptDialog from '../../components/admin/PromptDialog';
import { AdminTableSkeleton } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';

function CreateRunModal({ drivers, readyOrders, onClose, onCreated }) {
  const create = useCreateDeliveryRun();
  const [driverId, setDriverId] = useState('');
  const [title, setTitle] = useState('');
  const [hubNote, setHubNote] = useState('');
  const [orderIds, setOrderIds] = useState(new Set());
  const [error, setError] = useState('');

  const toggle = (id) => {
    setOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await create.mutateAsync({
        driver_user_id: Number(driverId),
        order_ids: [...orderIds],
        title: title.trim() || undefined,
        hub_note: hubNote.trim() || undefined,
      });
      onCreated(res.run?.id);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create run.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !create.isPending && onClose()}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 dark:bg-[#1E1E1E]" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-extrabold">New delivery run</h2>
        {error && <p className="mt-2 text-sm font-semibold text-brand-red">{error}</p>}
        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Driver</span>
            <select className="input-field w-full" value={driverId} onChange={(e) => setDriverId(e.target.value)} required>
              <option value="">Select driver</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.email})</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Run title (optional)</span>
            <input className="input-field w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Accra stations — Mon AM" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Hub note for driver</span>
            <textarea className="input-field w-full" rows={2} value={hubNote} onChange={(e) => setHubNote(e.target.value)} />
          </label>
          <div>
            <p className="mb-2 text-sm font-semibold">Orders at hub ({readyOrders.length})</p>
            {readyOrders.length === 0 ? (
              <p className="text-sm text-muted">No orders ready — receive parcels at hub first.</p>
            ) : (
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-black/8 p-2 dark:border-white/10">
                {readyOrders.map((o) => (
                  <li key={o.id}>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input type="checkbox" checked={orderIds.has(o.id)} onChange={() => toggle(o.id)} className="h-4 w-4 accent-brand-green" />
                      #{o.id} → {o.station_name}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={create.isPending} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={create.isPending || orderIds.size === 0} className="btn-primary">
              {create.isPending ? 'Creating…' : 'Create draft run'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DriverModal({ onClose, onCreated }) {
  const create = useCreateDriverAccount();
  const [form, setForm] = useState({ name: '', email: '', username: '', phone: '', temp_password: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await create.mutateAsync(form);
      setResult(res);
      onCreated();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create driver.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !create.isPending && onClose()}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-[#1E1E1E]" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-extrabold">Add driver account</h2>
        {result ? (
          <div className="mt-4 space-y-2 text-sm">
            <p className="font-semibold text-brand-green">Driver created.</p>
            {result.driver?.staff_id && (
              <p className="font-mono text-xs font-bold text-brand-green">Staff ID: {result.driver.staff_id}</p>
            )}
            <p>Email: {result.driver?.email}</p>
            <p>Username: {result.driver?.username}</p>
            <p className="rounded-lg bg-black/5 p-3 font-mono text-xs dark:bg-white/10">
              Temp password: {result.temp_password}
            </p>
            <button type="button" onClick={onClose} className="btn-primary mt-4 w-full">Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3">
            {error && <p className="text-sm font-semibold text-brand-red">{error}</p>}
            <input className="input-field w-full" placeholder="Full name" value={form.name} onChange={set('name')} required />
            <input className="input-field w-full" type="email" placeholder="Email" value={form.email} onChange={set('email')} required />
            <input className="input-field w-full" placeholder="Username (optional)" value={form.username} onChange={set('username')} />
            <input className="input-field w-full" placeholder="Phone" value={form.phone} onChange={set('phone')} />
            <input className="input-field w-full" placeholder="Temp password (optional)" value={form.temp_password} onChange={set('temp_password')} />
            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
              <button type="submit" disabled={create.isPending} className="btn-primary">{create.isPending ? 'Creating…' : 'Create'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function RunDetail({ runId, onBack }) {
  const { data: run, isLoading } = useAdminDeliveryRun(runId);
  const dispatch = useDispatchDeliveryRun();
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const doDispatch = async () => {
    setErr('');
    setMsg('');
    try {
      const res = await dispatch.mutateAsync(runId);
      setMsg(res.message || 'Dispatched.');
    } catch (e) {
      setErr(e.response?.data?.message || 'Dispatch failed.');
    }
  };

  if (isLoading || !run) return <p className="text-sm text-muted">Loading run…</p>;

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-4 text-sm font-bold text-brand-green hover:underline">
        ← All runs
      </button>
      <h2 className="text-lg font-extrabold">{run.title || `Run #${run.id}`}</h2>
      <p className="text-sm text-muted capitalize">Status: {run.status} · Driver: {run.driver_name}</p>
      {run.hub_note && <p className="mt-2 text-sm">{run.hub_note}</p>}
      {msg && <AdminPageAlert type="success" message={msg} />}
      {err && <AdminPageAlert message={err} />}
      <ul className="mt-4 space-y-2">
        {(run.stops || []).map((s) => (
          <li key={s.id} className="rounded-lg border border-black/8 px-3 py-2 text-sm dark:border-white/10">
            <span className="font-bold">#{s.order_id}</span> → {s.station_name} ({s.status})
          </li>
        ))}
      </ul>
      {run.status === 'draft' && (
        <button type="button" disabled={dispatch.isPending} onClick={doDispatch} className="btn-compact-primary mt-4">
          {dispatch.isPending ? 'Dispatching…' : 'Dispatch to driver'}
        </button>
      )}
    </div>
  );
}

export default function AdminDeliveryRunsPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = hasAnyPermission(user, ['manage_delivery_runs', 'edit_company_settings']);
  const canDelete = hasAnyPermission(user, ['delete_accounts', 'manage_delivery_runs', 'edit_company_settings']);
  const [filter, setFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showDriver, setShowDriver] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [driverToDelete, setDriverToDelete] = useState(null);
  const [pageAlert, setPageAlert] = useState('');
  const [pageAlertType, setPageAlertType] = useState('error');
  const deleteDriver = useDeleteDriverAccount();

  const { data: runs = [], isLoading } = useAdminDeliveryRuns(filter === 'all' ? null : filter, canManage && !detailId);
  const { data: drivers = [] } = useAdminDrivers(canManage);
  const { data: readyOrders = [] } = useAdminHubQueue('ready', canManage && showCreate);

  const filteredRuns = useMemo(() => {
    if (filter === 'all') return runs;
    return runs.filter((r) => r.status === filter);
  }, [runs, filter]);

  if (!canManage) return <Navigate to="/admin/dashboard" replace />;

  if (detailId) {
    return (
      <div>
        <RunDetail runId={detailId} onBack={() => setDetailId(null)} />
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Delivery runs"
        subtitle="Assign hub parcels to drivers for drop-off at pickup stations."
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowDriver(true)} className="btn-ghost">
              Add driver
            </button>
            <button type="button" onClick={() => setShowCreate(true)} className="btn-primary">
              New run
            </button>
          </div>
        }
      />

      <AdminPageAlert message={pageAlert} type={pageAlertType} onDismiss={() => setPageAlert('')} />

      {drivers.length > 0 && (
        <div className="admin-panel mb-6">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">Drivers ({drivers.length})</p>
          <ul className="space-y-2">
            {drivers.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  <span className="font-bold">{d.name}</span>
                  <span className="text-muted"> · {d.email}</span>
                </span>
                {canDelete && (
                  <button
                    type="button"
                    className="text-xs font-bold text-brand-red hover:underline"
                    onClick={() => setDriverToDelete(d)}
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {['all', 'draft', 'dispatched', 'completed'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={filter === s ? 'admin-mobile-pill-active' : 'admin-mobile-pill'}
          >
            {s === 'all' ? 'All' : s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <AdminTableSkeleton rows={4} />
      ) : filteredRuns.length === 0 ? (
        <EmptyState title="No runs" message="Create a draft run from orders at hub, then dispatch to the driver." />
      ) : (
        <ul className="space-y-2">
          {filteredRuns.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setDetailId(r.id)}
                className="w-full rounded-xl border border-black/8 bg-white px-4 py-3 text-left transition hover:border-brand-green dark:border-white/10 dark:bg-[#1E1E1E]"
              >
                <p className="font-bold">{r.title || `Run #${r.id}`}</p>
                <p className="text-sm text-muted capitalize">
                  {r.status} · {r.driver_name} · {r.delivered_count}/{r.stop_count} stops
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {showCreate && (
        <CreateRunModal
          drivers={drivers}
          readyOrders={readyOrders}
          onClose={() => setShowCreate(false)}
          onCreated={(id) => { setShowCreate(false); if (id) setDetailId(id); }}
        />
      )}
      {showDriver && (
        <DriverModal onClose={() => setShowDriver(false)} onCreated={() => setShowDriver(false)} />
      )}

      <PromptDialog
        open={!!driverToDelete}
        onClose={() => !deleteDriver.isPending && setDriverToDelete(null)}
        onSubmit={async (typedEmail) => {
          if (!driverToDelete) return;
          try {
            await deleteDriver.mutateAsync({ id: driverToDelete.id, confirm_email: typedEmail });
            setPageAlert(`Deleted driver ${driverToDelete.email}.`);
            setPageAlertType('success');
            setDriverToDelete(null);
          } catch (e) {
            setPageAlert(e.response?.data?.message || 'Could not delete driver.');
            setPageAlertType('error');
          }
        }}
        title="Delete driver permanently"
        description={
          driverToDelete
            ? `Permanently delete driver "${driverToDelete.name}" (${driverToDelete.email})?\n\nThis cannot be undone.`
            : ''
        }
        label="Type the driver email exactly to confirm"
        expectedValue={driverToDelete?.email ?? null}
        submitLabel="Delete driver"
        loading={deleteDriver.isPending}
        variant="danger"
      />
    </div>
  );
}
