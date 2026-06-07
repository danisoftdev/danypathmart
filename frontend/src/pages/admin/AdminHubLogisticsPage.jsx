import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  useAdminHubQueue,
  useHubMarkReadyForPickup,
  useHubReceiveOrders,
} from '../../hooks/admin';
import { useAuthStore } from '../../store/authStore';
import { hasAnyPermission } from '../../lib/permissions';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminPageAlert from '../../components/admin/AdminPageAlert';
import { AdminTableSkeleton } from '../../components/ui/Skeleton';
import { formatPrice } from '../../lib/currency';
import EmptyState from '../../components/ui/EmptyState';

const TABS = [
  { key: 'receive', label: 'Receive at hub', hint: 'Paid pickup orders awaiting hub intake' },
  { key: 'ready', label: 'Ready for run', hint: 'At hub — assign to a delivery run' },
  { key: 'station', label: 'Station receive', hint: 'Dropped by driver — mark ready for customer pickup' },
];

function OrderQueueTable({ rows, selected, onToggle, onToggleAll }) {
  if (rows.length === 0) {
    return <EmptyState title="Queue empty" message="No orders in this queue right now." />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-black/8 dark:border-white/10">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-black/5 text-xs font-bold uppercase dark:bg-white/5">
          <tr>
            <th className="p-3">
              <input
                type="checkbox"
                checked={selected.size === rows.length && rows.length > 0}
                onChange={onToggleAll}
                className="h-4 w-4 accent-brand-green"
              />
            </th>
            <th className="p-3">Order</th>
            <th className="p-3">Customer</th>
            <th className="p-3">Station</th>
            <th className="p-3">Total</th>
            <th className="p-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-black/5 dark:border-white/10">
              <td className="p-3">
                <input
                  type="checkbox"
                  checked={selected.has(row.id)}
                  onChange={() => onToggle(row.id)}
                  className="h-4 w-4 accent-brand-green"
                />
              </td>
              <td className="p-3 font-bold">#{row.id}</td>
              <td className="p-3">{row.customer_name}</td>
              <td className="p-3">
                {row.station_name}
                {row.station_city ? ` · ${row.station_city}` : ''}
              </td>
              <td className="p-3">{formatPrice(row.total)}</td>
              <td className="p-3 capitalize">{(row.status || '').replace(/_/g, ' ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminHubLogisticsPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = hasAnyPermission(user, ['manage_hub_logistics', 'edit_company_settings']);
  const [tab, setTab] = useState('receive');
  const [selected, setSelected] = useState(new Set());
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const { data: rows = [], isLoading } = useAdminHubQueue(tab, canManage);
  const receive = useHubReceiveOrders();
  const markReady = useHubMarkReadyForPickup();

  const tabMeta = useMemo(() => TABS.find((t) => t.key === tab), [tab]);

  if (!canManage) return <Navigate to="/admin/dashboard" replace />;

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  };

  const runAction = async () => {
    setError('');
    setMessage('');
    const orderIds = [...selected];
    if (orderIds.length === 0) {
      setError('Select at least one order.');
      return;
    }
    try {
      if (tab === 'receive') {
        const res = await receive.mutateAsync({ order_ids: orderIds, note: note.trim() || undefined });
        setMessage(res.message || 'Updated.');
      } else if (tab === 'station') {
        const res = await markReady.mutateAsync({ order_ids: orderIds, note: note.trim() || undefined });
        setMessage(res.message || 'Updated.');
      } else {
        setError('Use Delivery runs to dispatch orders at hub.');
        return;
      }
      setSelected(new Set());
      setNote('');
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed.');
    }
  };

  const busy = receive.isPending || markReady.isPending;
  const actionLabel =
    tab === 'receive' ? 'Mark received at hub' : tab === 'station' ? 'Mark ready for pickup' : null;

  return (
    <div>
      <AdminPageHeader
        title="Hub logistics"
        subtitle="Receive seller parcels, build delivery runs, and hand off to pickup stations."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setSelected(new Set()); setMessage(''); setError(''); }}
            className={tab === t.key ? 'admin-mobile-pill-active' : 'admin-mobile-pill'}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tabMeta && <p className="mb-4 text-sm text-muted">{tabMeta.hint}</p>}

      {message && <AdminPageAlert type="success" message={message} />}
      {error && <AdminPageAlert message={error} />}

      {isLoading ? (
        <AdminTableSkeleton rows={5} />
      ) : (
        <OrderQueueTable rows={rows} selected={selected} onToggle={toggle} onToggleAll={toggleAll} />
      )}

      {tab !== 'ready' && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm">
            <span className="mb-1 block font-semibold">Note (optional)</span>
            <input className="input-field w-full" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal note for tracking" />
          </label>
          {actionLabel && (
            <button type="button" disabled={busy} onClick={runAction} className="btn-compact-primary">
              {busy ? 'Saving…' : actionLabel}
            </button>
          )}
        </div>
      )}

      {tab === 'ready' && rows.length > 0 && (
        <p className="mt-4 text-sm text-muted">
          Go to <strong>Delivery runs</strong> to assign these orders to a driver and dispatch.
        </p>
      )}

      {tab === 'station' && (
        <p className="mb-4 rounded-lg bg-brand-gold/10 px-3 py-2 text-sm text-amber-900">
          When <strong>Station repack module</strong> is enabled, station staff repack orders at{' '}
          <strong>/station</strong>. This admin tab is only used if repack is turned off.
        </p>
      )}
    </div>
  );
}
