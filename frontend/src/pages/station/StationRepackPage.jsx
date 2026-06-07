import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useStationQueue, useStationRepackComplete } from '../../hooks/station';
import { formatPrice } from '../../lib/currency';
import EmptyState from '../../components/ui/EmptyState';

function OrderList({ rows, selected, onToggle, onToggleAll, showBag }) {
  if (rows.length === 0) {
    return <EmptyState title="Nothing here" message="No orders in this queue." />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-black/8 dark:border-white/10">
      <table className="w-full min-w-[520px] text-left text-sm">
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
            <th className="p-3">Total</th>
            {showBag && <th className="p-3">Bag</th>}
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
              <td className="p-3">
                <p>{row.customer_name}</p>
                {row.customer_phone && <p className="text-xs text-muted">{row.customer_phone}</p>}
              </td>
              <td className="p-3">{formatPrice(row.total)}</td>
              {showBag && <td className="p-3 text-xs">{row.bag_label || '—'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StationInboundPage() {
  const { data: rows = [], isLoading } = useStationQueue('inbound');
  const repack = useStationRepackComplete();
  const [selected, setSelected] = useState(new Set());
  const [bagLabel, setBagLabel] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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

  const submit = async () => {
    setError('');
    setMessage('');
    const orderIds = [...selected];
    if (orderIds.length === 0) {
      setError('Select at least one order.');
      return;
    }
    try {
      const res = await repack.mutateAsync({
        order_ids: orderIds,
        bag_label: bagLabel.trim() || undefined,
        note: note.trim() || undefined,
      });
      setMessage(res.message || 'Repack complete.');
      setSelected(new Set());
      setBagLabel('');
      setNote('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not complete repack.');
    }
  };

  if (isLoading) return <p className="text-sm text-muted">Loading inbound orders…</p>;

  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        Parcels from hub drivers. Repack into DPM bags, apply station labels, then mark ready for customer pickup.
      </p>
      {message && <p className="mb-3 rounded-lg bg-brand-green/10 px-3 py-2 text-sm font-semibold text-brand-green">{message}</p>}
      {error && <p className="mb-3 rounded-lg bg-brand-red/10 px-3 py-2 text-sm font-semibold text-brand-red">{error}</p>}
      <OrderList rows={rows} selected={selected} onToggle={toggle} onToggleAll={toggleAll} />
      {rows.length > 0 && (
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">DPM bag / shelf label (optional)</span>
            <input
              className="input-field w-full"
              value={bagLabel}
              onChange={(e) => setBagLabel(e.target.value)}
              placeholder="e.g. Bag A-12"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Note (optional)</span>
            <input className="input-field w-full" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button type="button" disabled={repack.isPending} onClick={submit} className="btn-compact-primary w-full">
            {repack.isPending ? 'Saving…' : 'Complete repack — ready for pickup'}
          </button>
        </div>
      )}
    </div>
  );
}

export function StationReadyPage() {
  const { station } = useOutletContext() || {};
  const { data: rows = [], isLoading } = useStationQueue('ready');
  const collect = useStationCollect();
  const [selected, setSelected] = useState(new Set());
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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

  const submit = async () => {
    setError('');
    setMessage('');
    const orderIds = [...selected];
    if (orderIds.length === 0) {
      setError('Select at least one order.');
      return;
    }
    try {
      const res = await collect.mutateAsync({ order_ids: orderIds, note: note.trim() || undefined });
      setMessage(res.message || 'Marked collected.');
      setSelected(new Set());
      setNote('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not mark collected.');
    }
  };

  if (isLoading) return <p className="text-sm text-muted">Loading ready orders…</p>;

  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        Customer collection at {station?.name || 'your station'}. Verify ID or order number, then release.
      </p>
      {message && <p className="mb-3 rounded-lg bg-brand-green/10 px-3 py-2 text-sm font-semibold text-brand-green">{message}</p>}
      {error && <p className="mb-3 rounded-lg bg-brand-red/10 px-3 py-2 text-sm font-semibold text-brand-red">{error}</p>}
      <OrderList rows={rows} selected={selected} onToggle={toggle} onToggleAll={toggleAll} showBag />
      {rows.length > 0 && (
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Collection note (optional)</span>
            <input className="input-field w-full" value={note} onChange={(e) => setNote(e.target.value)} placeholder="ID verified, etc." />
          </label>
          <button type="button" disabled={collect.isPending} onClick={submit} className="btn-compact-primary w-full">
            {collect.isPending ? 'Saving…' : 'Confirm customer collected'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function StationRepackPage() {
  return <StationInboundPage />;
}
