import { useEffect, useState } from 'react';
import { resolveImageUrl } from '../../lib/currency';
import { useImageAlerts, useUpdateAlert } from '../../hooks/admin';

const STATUSES = ['pending', 'reviewed', 'actioned'];

const STATUS_STYLES = {
  pending: 'bg-brand-gold/20 text-amber-700',
  reviewed: 'bg-brand-green/15 text-brand-green',
  actioned: 'bg-black/10 text-black/60 dark:bg-white/10 dark:text-white/60',
};

function StatusPill({ status }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[status] || ''}`}>
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 dark:bg-[#1c1c1c]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-bold">Image search alert #{alert.id}</h2>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-black/40 dark:text-white/40">
            &times;
          </button>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <AlertImage
            path={alert.image_path}
            className="aspect-square w-full rounded-xl border border-black/10 object-cover dark:border-white/15"
          />

          <div className="space-y-3 text-sm">
            <div>
              <p className="text-black/40 dark:text-white/40">Customer</p>
              <p className="font-medium">
                {alert.user ? `${alert.user.name} (${alert.user.email})` : 'Guest'}
              </p>
            </div>
            <div>
              <p className="text-black/40 dark:text-white/40">When</p>
              <p className="font-medium">{alert.created_at}</p>
            </div>
            {alert.search_query && (
              <div>
                <p className="text-black/40 dark:text-white/40">Customer description</p>
                <p className="font-medium">{alert.search_query}</p>
              </div>
            )}
            <div>
              <p className="text-black/40 dark:text-white/40">Detected labels</p>
              {alert.labels.length ? (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {alert.labels.map((l) => (
                    <span key={l} className="rounded-full bg-brand-green/10 px-2 py-0.5 text-xs text-brand-green">
                      {l}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="italic text-black/40 dark:text-white/40">None detected</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 capitalize dark:border-white/15 dark:bg-[#111]"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Admin note</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Sourcing notes, supplier, decision..."
              className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 outline-none focus:border-brand-green dark:border-white/15 dark:bg-[#111]"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-black/15 px-5 py-2 text-sm dark:border-white/15"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={update.isPending}
            className="rounded-lg bg-brand-green px-5 py-2 text-sm font-semibold text-white transition hover:bg-opacity-90 disabled:opacity-50"
          >
            {update.isPending ? 'Saving...' : 'Save'}
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

  // Close modal on Escape.
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => e.key === 'Escape' && setActive(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Image Search Alerts</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm capitalize dark:border-white/15 dark:bg-[#1c1c1c]"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white dark:border-white/10 dark:bg-[#1c1c1c]">
        {isLoading ? (
          <p className="p-8 text-center text-black/60 dark:text-white/60">Loading alerts...</p>
        ) : alerts.length === 0 ? (
          <p className="p-8 text-center text-black/60 dark:text-white/60">No alerts to review.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/10 text-xs uppercase tracking-wide text-black/40 dark:border-white/10 dark:text-white/40">
              <tr>
                <th className="p-3">Image</th>
                <th className="p-3">Customer</th>
                <th className="p-3 hidden sm:table-cell">Date</th>
                <th className="p-3 hidden md:table-cell">Labels</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => setActive(a)}
                  className="cursor-pointer border-b border-black/5 transition hover:bg-black/[0.03] dark:border-white/5 dark:hover:bg-white/[0.04]"
                >
                  <td className="p-3">
                    <AlertImage path={a.image_path} className="h-12 w-12 rounded-lg object-cover" />
                  </td>
                  <td className="p-3">{a.user ? a.user.name : 'Guest'}</td>
                  <td className="p-3 hidden text-black/60 sm:table-cell dark:text-white/60">{a.created_at}</td>
                  <td className="p-3 hidden md:table-cell">
                    <span className="line-clamp-1 text-black/60 dark:text-white/60">
                      {a.labels.length ? a.labels.join(', ') : a.search_query || '\u2014'}
                    </span>
                  </td>
                  <td className="p-3">
                    <StatusPill status={a.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {active && <ReviewModal alert={active} onClose={() => setActive(null)} />}
    </div>
  );
}
