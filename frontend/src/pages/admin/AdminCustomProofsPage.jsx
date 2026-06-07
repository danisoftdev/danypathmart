import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { resolveImageUrl } from '../../lib/currency';
import { useCustomProofs, useReviewCustomProof } from '../../hooks/admin';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminTable, { AdminTableCell, AdminTableRow } from '../../components/admin/AdminTable';
import AdminFilterBar, { AdminFilterSelect } from '../../components/admin/AdminFilterBar';
import { AdminTableSkeleton } from '../../components/ui/Skeleton';

const STATUSES = ['', 'pending', 'approved', 'rejected'];

const STATUS_STYLES = {
  pending: 'bg-brand-gold/20 text-amber-800 dark:text-brand-gold',
  approved: 'bg-brand-green/15 text-brand-green',
  rejected: 'bg-brand-red/15 text-brand-red',
};

function ReviewModal({ proof, onClose }) {
  const review = useReviewCustomProof();
  const [status, setStatus] = useState(proof.status);
  const [note, setNote] = useState(proof.admin_note || '');

  const save = async () => {
    await review.mutateAsync({ id: proof.id, status, admin_note: note });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 dark:bg-[#1E1E1E] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-extrabold">Proof #{proof.id}</h2>
        <p className="mt-1 text-sm text-muted">
          Order #{proof.order_id} · {proof.product_name}
        </p>
        {proof.file_path && (
          <a
            href={resolveImageUrl(proof.file_path)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 block text-sm font-bold text-brand-green hover:underline"
          >
            View uploaded artwork →
          </a>
        )}
        {proof.label_text && (
          <p className="mt-3 rounded-lg bg-black/5 px-3 py-2 text-sm dark:bg-white/5">
            <span className="font-bold">Label text:</span> {proof.label_text}
          </p>
        )}
        <label className="mt-4 block text-sm">
          <span className="mb-1 block font-bold">Status</span>
          <select className="input-field" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="pending">Pending</option>
            <option value="approved">Approved — start production</option>
            <option value="rejected">Rejected — needs changes</option>
          </select>
        </label>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block font-bold">Note to customer</span>
          <textarea className="input-field min-h-[80px]" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border px-4 py-2.5 text-sm font-bold">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={review.isPending} className="btn-primary flex-1 py-2.5 text-sm">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminCustomProofsPage() {
  const [params] = useSearchParams();
  const orderFilter = params.get('order_id') || '';
  const [status, setStatus] = useState('pending');
  const [selected, setSelected] = useState(null);
  const { data: proofs = [], isLoading } = useCustomProofs(status, orderFilter || undefined);

  return (
    <div>
      <AdminPageHeader
        title="Custom proofs"
        subtitle="Review uploaded badge artwork before production."
      />

      <AdminFilterBar>
        <AdminFilterSelect label="Status" value={status} onChange={setStatus}>
          {STATUSES.map((s) => (
            <option key={s || 'all'} value={s}>{s || 'All'}</option>
          ))}
        </AdminFilterSelect>
      </AdminFilterBar>

      {isLoading ? (
        <AdminTableSkeleton rows={4} />
      ) : (
        <AdminTable
          columns={[
            { key: 'id', label: '#' },
            { key: 'order', label: 'Order' },
            { key: 'product', label: 'Product' },
            { key: 'customer', label: 'Customer' },
            { key: 'status', label: 'Status' },
            { key: 'date', label: 'Date' },
          ]}
          emptyMessage="No custom proofs in this view."
        >
          {proofs.length === 0 ? (
            <AdminTableRow>
              <AdminTableCell colSpan={6} className="text-center text-muted">
                No custom proofs in this view.
              </AdminTableCell>
            </AdminTableRow>
          ) : (
            proofs.map((p) => (
              <AdminTableRow key={p.id} onClick={() => setSelected(p)}>
                <AdminTableCell className="font-bold">#{p.id}</AdminTableCell>
                <AdminTableCell>#{p.order_id}</AdminTableCell>
                <AdminTableCell>{p.product_name}</AdminTableCell>
                <AdminTableCell className="text-muted">{p.customer_name}</AdminTableCell>
                <AdminTableCell>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold capitalize ${STATUS_STYLES[p.status] || ''}`}>
                    {p.status}
                  </span>
                </AdminTableCell>
                <AdminTableCell className="text-muted">
                  {new Date(p.created_at).toLocaleDateString()}
                </AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTable>
      )}

      {selected && <ReviewModal proof={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
