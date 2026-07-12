import { useEffect, useMemo, useState } from 'react';
import {
  useCreateSizeGuide,
  useDeleteSizeGuide,
  useSizeGuide,
  useSizeGuides,
  useUpdateSizeGuide,
} from '../../hooks/admin';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminTable, { AdminTableCell, AdminTableRow } from '../../components/admin/AdminTable';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import AdminPageAlert from '../../components/admin/AdminPageAlert';
import Modal from '../../components/dashboard/Modal';
import { AdminTableSkeleton } from '../../components/ui/Skeleton';

const EMPTY_ROW = {
  size_label: '',
  chest_min: '',
  chest_max: '',
  waist_min: '',
  waist_max: '',
  height_min: '',
  height_max: '',
};

function GuideEditor({ guideId, onClose, onSaved }) {
  const isNew = !guideId;
  const { data: loaded, isLoading } = useSizeGuide(guideId);
  const createGuide = useCreateSizeGuide();
  const updateGuide = useUpdateSizeGuide();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState([{ ...EMPTY_ROW }]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isNew || !loaded) return;
    setName(loaded.name || '');
    setNotes(loaded.notes || '');
    setRows(
      loaded.rows?.length
        ? loaded.rows.map((r) => ({
            size_label: r.size_label || '',
            chest_min: r.chest_min ?? '',
            chest_max: r.chest_max ?? '',
            waist_min: r.waist_min ?? '',
            waist_max: r.waist_max ?? '',
            height_min: r.height_min ?? '',
            height_max: r.height_max ?? '',
          }))
        : [{ ...EMPTY_ROW }]
    );
  }, [isNew, loaded]);

  const pending = createGuide.isPending || updateGuide.isPending;

  const setRow = (idx, key, value) => {
    setRows((list) => list.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  };

  const addRow = () => setRows((list) => [...list, { ...EMPTY_ROW }]);
  const removeRow = (idx) => setRows((list) => (list.length <= 1 ? list : list.filter((_, i) => i !== idx)));

  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Guide name is required.');
    const payloadRows = rows
      .filter((r) => r.size_label.trim())
      .map((r, i) => ({
        size_label: r.size_label.trim(),
        chest_min: numOrNull(r.chest_min),
        chest_max: numOrNull(r.chest_max),
        waist_min: numOrNull(r.waist_min),
        waist_max: numOrNull(r.waist_max),
        height_min: numOrNull(r.height_min),
        height_max: numOrNull(r.height_max),
        sort_order: i,
      }));
    if (!payloadRows.length) return setError('Add at least one size row with a label.');
    try {
      if (isNew) {
        await createGuide.mutateAsync({ name: name.trim(), notes: notes.trim() || null, rows: payloadRows });
      } else {
        await updateGuide.mutateAsync({
          id: guideId,
          name: name.trim(),
          notes: notes.trim() || null,
          rows: payloadRows,
        });
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save size guide.');
    }
  };

  if (!isNew && isLoading) {
    return (
      <Modal open onClose={onClose} title="Edit size guide" maxWidth="max-w-4xl">
        <p className="text-sm text-muted">Loading…</p>
      </Modal>
    );
  }

  return (
    <Modal open onClose={pending ? undefined : onClose} title={isNew ? 'New size guide' : 'Edit size guide'} maxWidth="max-w-4xl">
      <form onSubmit={save}>
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-bold">Name</span>
            <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Apparel sizes" />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-bold">Notes (optional)</span>
            <input className="input-field" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Shown on product pages" />
          </label>
        </div>

        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Measurement rows (cm)</p>
        <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
          {rows.map((row, idx) => (
            <div key={idx} className="grid gap-2 rounded-xl border border-black/8 p-3 dark:border-white/10 sm:grid-cols-8">
              <input
                className="input-field sm:col-span-2"
                placeholder="Size (S, M, 32…)"
                value={row.size_label}
                onChange={(e) => setRow(idx, 'size_label', e.target.value)}
              />
              {['chest', 'waist', 'height'].map((dim) => (
                <div key={dim} className="flex gap-1 sm:col-span-2">
                  <input
                    type="number"
                    step="0.1"
                    className="input-field w-full py-2 text-xs"
                    placeholder={`${dim} min`}
                    value={row[`${dim}_min`]}
                    onChange={(e) => setRow(idx, `${dim}_min`, e.target.value)}
                  />
                  <input
                    type="number"
                    step="0.1"
                    className="input-field w-full py-2 text-xs"
                    placeholder={`${dim} max`}
                    value={row[`${dim}_max`]}
                    onChange={(e) => setRow(idx, `${dim}_max`, e.target.value)}
                  />
                </div>
              ))}
              <button type="button" onClick={() => removeRow(idx)} className="text-xs font-bold text-brand-red sm:col-span-2">
                Remove row
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addRow} className="mt-2 text-sm font-bold text-brand-green">
          + Add size row
        </button>

        {error && <p className="mt-3 text-sm text-brand-red">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={pending} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? 'Saving…' : 'Save guide'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function numOrNull(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function AdminSizeGuidesPage() {
  const { data: guides = [], isLoading } = useSizeGuides();
  const deleteGuide = useDeleteSizeGuide();
  const [editorId, setEditorId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pageError, setPageError] = useState('');

  const sorted = useMemo(
    () => [...guides].sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [guides]
  );

  const closeEditor = () => {
    setEditorId(null);
    setCreating(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setPageError('');
    try {
      await deleteGuide.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setPageError(err.response?.data?.message || 'Could not delete size guide.');
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <AdminPageHeader
        title="Size guides"
        subtitle="Measurement charts for product lines. Link guides to categories (or individual products)."
        actions={
          <button type="button" onClick={() => setCreating(true)} className="btn-primary">
            + New guide
          </button>
        }
      />

      <AdminPageAlert message={pageError} onDismiss={() => setPageError('')} />

      {isLoading ? (
        <AdminTableSkeleton rows={4} cols={3} />
      ) : (
        <AdminTable
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'notes', label: 'Notes' },
            { key: 'actions', label: '', className: 'text-right' },
          ]}
        >
          {sorted.length === 0 ? (
            <AdminTableRow>
              <AdminTableCell className="text-center text-muted">No size guides yet.</AdminTableCell>
              <AdminTableCell />
              <AdminTableCell />
            </AdminTableRow>
          ) : (
            sorted.map((g) => (
              <AdminTableRow key={g.id}>
                <AdminTableCell className="font-bold">{g.name}</AdminTableCell>
                <AdminTableCell className="text-muted">{g.notes || '—'}</AdminTableCell>
                <AdminTableCell>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setEditorId(g.id)} className="text-xs font-bold text-brand-green">
                      Edit
                    </button>
                    <button type="button" onClick={() => setDeleteTarget(g)} className="text-xs font-bold text-brand-red">
                      Delete
                    </button>
                  </div>
                </AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTable>
      )}

      {(creating || editorId) && (
        <GuideEditor
          key={creating ? 'new' : editorId}
          guideId={creating ? null : editorId}
          onClose={closeEditor}
          onSaved={closeEditor}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete size guide?"
        message={
          deleteTarget
            ? `Delete "${deleteTarget.name}"? Categories using this guide will need a new assignment.`
            : ''
        }
        confirmLabel="Delete"
        loading={deleteGuide.isPending}
      />
    </div>
  );
}
