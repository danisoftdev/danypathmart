import { useEffect, useState } from 'react';
import { resolveImageUrl } from '../../lib/currency';
import { useImageAlerts, useUpdateAlert } from '../../hooks/admin';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminTable, { AdminTableCell, AdminTableRow } from '../../components/admin/AdminTable';
import AdminFilterBar, { AdminFilterSelect } from '../../components/admin/AdminFilterBar';
import AdminStatCard from '../../components/admin/AdminStatCard';
import EmptyState from '../../components/ui/EmptyState';
import { AdminTableSkeleton } from '../../components/ui/Skeleton';

const STATUSES = ['pending', 'reviewed', 'actioned'];

const STATUS_STYLES = {
  pending: 'bg-brand-gold/20 text-amber-800 dark:text-brand-gold',
  reviewed: 'bg-brand-green/15 text-brand-green',
  actioned: 'bg-black/10 text-muted',
};

function StatusPill({ status }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${STATUS_STYLES[status] || ''}`}>
      {status}
    </span>
  );
}

function AlertImage({ path, className }) {
  const [errored, setErrored] = useState(false);
  const url = resolveImageUrl(path);
  if (!url || errored) {
    return (
      <div className={`flex items-center justify-center bg-brand-green/10 ${className}`}>
        <span className="text-xs font-bold text-brand-green/40">IMG</span>
      </div>
    );
  }
  return <img src={url} alt="Search" onError={() => setErrored(true)} className={className} />;
}

function ReviewModal({ alert, onClose }) {
  const update = useUpdateAlert();
  const [status, setStatus] = useState(alert.status);
  const [note, setNote] = useState(alert.admin_note || '');

  const save = async () => {
    await update.mutateAsync({ id: alert.id, status, admin_note: note });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-6 dark:bg-[#1E1E1E] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-brand-green">Image search alert</p>
            <h2 className="text-xl font-extrabold">Alert #{alert.id}</h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5 text-xl dark:bg-white/10">
            ×
          </button>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <AlertImage
            path={alert.image_path}
            className="aspect-square w-full rounded-2xl border border-black/10 object-cover dark:border-white/15"
          />

          <div className="space-y-4 text-sm">
            <div className="admin-panel p-4">
              <p className="text-xs font-bold uppercase text-muted">Customer</p>
              <p className="mt-1 font-bold">
                {alert.user ? `${alert.user.name}` : 'Guest'}
              </p>
              {alert.user?.email && <p className="text-muted">{alert.user.email}</p>}
            </div>
            <div className="admin-panel p-4">
              <p className="text-xs font-bold uppercase text-muted">Submitted</p>
              <p className="mt-1 font-medium">{alert.created_at}</p>
            </div>
            {alert.search_query && (
              <div className="admin-panel p-4">
                <p className="text-xs font-bold uppercase text-muted">Description</p>
                <p className="mt-1">{alert.search_query}</p>
              </div>
            )}
            <div className="admin-panel p-4">
              <p className="text-xs font-bold uppercase text-muted">Detected labels</p>
              {alert.labels.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {alert.labels.map((l) => (
                    <span key={l} className="rounded-full bg-brand-green/10 px-2 py-0.5 text-xs font-semibold text-brand-green">
                      {l}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 italic text-muted">None detected</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1.5 block font-bold">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="admin-filter-select w-full capitalize"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1.5 block font-bold">Admin note</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Sourcing notes, supplier, decision…"
              className="input-field min-h-[88px] resize-y text-sm"
            />
          </label>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="min-h-[44px] rounded-xl border-2 border-black/10 px-6 font-bold dark:border-white/15">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={update.isPending} className="btn-primary min-h-[44px] px-8">
            {update.isPending ? 'Saving…' : 'Save review'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ImageAlertsPage() {
  const [filter, setFilter] = useState('');
  const [active, setActive] = useState(null);
  const { data, isLoading } = useImageAlerts(filter);
  const alerts = data?.data ?? [];

  const pendingCount = alerts.filter((a) => a.status === 'pending').length;

  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => e.key === 'Escape' && setActive(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active]);

  return (
    <div>
      <AdminPageHeader
        title="Image search alerts"
        subtitle="Review customer photo searches when no product match was found."
      >
        <AdminFilterBar>
          <AdminFilterSelect value={filter} onChange={setFilter} label="Filter">
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </AdminFilterSelect>
        </AdminFilterBar>
      </AdminPageHeader>

      {!isLoading && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <AdminStatCard label="Total shown" value={alerts.length} icon="🖼️" tone="neutral" />
          <AdminStatCard label="Pending review" value={pendingCount} icon="⏳" tone={pendingCount ? 'gold' : 'green'} />
          <AdminStatCard label="Filter" value={filter || 'All'} icon="🔍" tone="neutral" />
        </div>
      )}

      {isLoading ? (
        <AdminTableSkeleton rows={5} cols={5} />
      ) : alerts.length === 0 ? (
        <EmptyState
          title="No image alerts"
          message="When customers search by image and no product matches, alerts appear here."
        />
      ) : (
        <AdminTable
          columns={[
            { key: 'img', label: 'Image' },
            { key: 'customer', label: 'Customer' },
            { key: 'date', label: 'Date', className: 'hidden sm:table-cell' },
            { key: 'labels', label: 'Labels', className: 'hidden md:table-cell' },
            { key: 'status', label: 'Status' },
          ]}
        >
          {alerts.map((a) => (
            <AdminTableRow key={a.id} onClick={() => setActive(a)}>
              <AdminTableCell>
                <AlertImage path={a.image_path} className="h-12 w-12 rounded-xl object-cover" />
              </AdminTableCell>
              <AdminTableCell className="font-medium">{a.user ? a.user.name : 'Guest'}</AdminTableCell>
              <AdminTableCell className="hidden text-muted sm:table-cell">{a.created_at}</AdminTableCell>
              <AdminTableCell className="hidden max-w-[200px] truncate text-muted md:table-cell">
                {a.labels.length ? a.labels.join(', ') : a.search_query || '—'}
              </AdminTableCell>
              <AdminTableCell><StatusPill status={a.status} /></AdminTableCell>
            </AdminTableRow>
          ))}
        </AdminTable>
      )}

      {active && <ReviewModal alert={active} onClose={() => setActive(null)} />}
    </div>
  );
}
