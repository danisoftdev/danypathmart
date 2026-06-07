import { useState } from 'react';
import { useConfirmDriverStop, useDriverRuns } from '../../hooks/driver';
import { formatPrice } from '../../lib/currency';
import EmptyState from '../../components/ui/EmptyState';

function StopCard({ run, stop, onDone, loading }) {
  const pending = stop.status === 'pending';

  return (
    <li className="rounded-xl border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-[#1E1E1E]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase text-brand-green">Stop #{stop.stop_order}</p>
          <p className="font-extrabold">Order #{stop.order_id}</p>
          <p className="text-sm text-muted">{stop.station_name} · {stop.station_city}</p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${pending ? 'bg-brand-gold/20 text-amber-800' : 'bg-brand-green/15 text-brand-green'}`}>
          {stop.status}
        </span>
      </div>
      {stop.station_address && (
        <p className="mt-2 text-sm">{stop.station_address}</p>
      )}
      {stop.station_phone && (
        <p className="mt-1 text-sm font-semibold">Station: {stop.station_phone}</p>
      )}
      <p className="mt-1 text-xs text-muted">Order total {formatPrice(stop.order_total)}</p>
      {pending && (
        <button
          type="button"
          disabled={loading}
          onClick={() => onDone(run.id, stop.order_id)}
          className="btn-compact-primary mt-4 w-full"
        >
          {loading ? 'Confirming…' : 'Confirm drop at station'}
        </button>
      )}
      {stop.delivered_at && (
        <p className="mt-2 text-xs text-muted">Delivered {new Date(stop.delivered_at).toLocaleString()}</p>
      )}
    </li>
  );
}

export default function DriverRunsPage() {
  const { data: runs = [], isLoading, refetch } = useDriverRuns();
  const confirm = useConfirmDriverStop();
  const [error, setError] = useState('');
  const [busyOrder, setBusyOrder] = useState(null);

  const handleConfirm = async (runId, orderId) => {
    setError('');
    setBusyOrder(orderId);
    try {
      await confirm.mutateAsync({ runId, orderId });
      refetch();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not confirm delivery.');
    } finally {
      setBusyOrder(null);
    }
  };

  if (isLoading) {
    return <p className="text-center text-sm text-muted">Loading your runs…</p>;
  }

  if (runs.length === 0) {
    return (
      <EmptyState
        title="No active runs"
        message="When hub staff dispatch a run to you, stops will appear here. Pick up parcels at the hub, then confirm each drop at the pickup station."
      />
    );
  }

  return (
    <div className="space-y-6">
      {error && <p className="rounded-lg bg-brand-red/10 px-3 py-2 text-sm font-semibold text-brand-red">{error}</p>}
      {runs.map((run) => (
        <div key={run.id} className="space-y-3">
          <div className="rounded-xl bg-brand-green/10 px-4 py-3">
            <p className="font-extrabold">{run.title || `Run #${run.id}`}</p>
            {run.hub_note && <p className="mt-1 text-sm text-muted">{run.hub_note}</p>}
            <p className="mt-1 text-xs text-muted">
              {run.delivered_count ?? 0} / {run.stop_count ?? run.stops?.length ?? 0} stops done
            </p>
          </div>
          <ul className="space-y-3">
            {(run.stops || []).map((stop) => (
              <StopCard
                key={stop.id}
                run={run}
                stop={stop}
                loading={busyOrder === stop.order_id && confirm.isPending}
                onDone={handleConfirm}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
