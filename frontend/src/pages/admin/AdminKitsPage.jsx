import { useEffect, useMemo, useState } from 'react';
import {
  useAdminKit,
  useAdminKits,
  useAdminProducts,
  useCreateKit,
  useDeleteKit,
  useUpdateKit,
} from '../../hooks/admin';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminTable, { AdminTableCell, AdminTableRow } from '../../components/admin/AdminTable';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import AdminPageAlert from '../../components/admin/AdminPageAlert';
import ProductImage from '../../components/product/ProductImage';
import KitCoverImageField from '../../components/admin/KitCoverImageField';
import Modal from '../../components/dashboard/Modal';
import { AdminTableSkeleton } from '../../components/ui/Skeleton';
import { formatPrice } from '../../lib/currency';

const EMPTY_ITEM = {
  product_id: '',
  product_name: '',
  product_price: null,
  product_image: null,
  is_required: true,
  item_label: '',
  note: '',
};

function ProductPicker({ onPick }) {
  const [q, setQ] = useState('');
  const term = q.trim();
  const { data: results = [] } = useAdminProducts(
    { search: term || undefined, status: 'active' },
    { enabled: term.length >= 2 }
  );

  return (
    <div className="rounded-xl border border-black/8 p-3 dark:border-white/10">
      <input
        className="input-field"
        placeholder="Search products to add…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />
      {term.length >= 2 && (
        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
          {results.length === 0 ? (
            <li className="px-2 py-2 text-xs text-muted">No active products found.</li>
          ) : (
            results.slice(0, 10).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onPick(p)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <ProductImage src={p.images?.[0]} alt="" className="h-8 w-8 rounded object-cover" />
                  <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                  <span className="shrink-0 text-xs text-brand-green">{formatPrice(p.price)}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function KitEditor({ kitId, onClose, onSaved }) {
  const isNew = !kitId;
  const { data: loaded, isLoading } = useAdminKit(kitId);
  const createKit = useCreateKit();
  const updateKit = useUpdateKit();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [leaderNote, setLeaderNote] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [published, setPublished] = useState(false);
  const [items, setItems] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isNew || !loaded) return;
    setName(loaded.name || '');
    setSlug(loaded.slug || '');
    setDescription(loaded.description || '');
    setLeaderNote(loaded.leader_note || '');
    setImageUrl(loaded.image_url || '');
    setPublished(!!loaded.is_published);
    setItems(
      loaded.items?.length
        ? loaded.items.map((row) => ({
            product_id: String(row.product_id),
            product_name: row.product?.name || row.label || '',
            product_price: row.product?.price ?? null,
            product_image: row.product?.images?.[0] ?? null,
            is_required: !!row.is_required,
            item_label: row.item_label || '',
            note: row.note || '',
          }))
        : []
    );
  }, [isNew, loaded]);

  const pending = createKit.isPending || updateKit.isPending;
  const shareUrl = slug ? `${window.location.origin}/kits/${slug}` : '';

  const addProduct = (product) => {
    if (items.some((i) => Number(i.product_id) === product.id)) return;
    setItems((list) => [
      ...list,
      {
        ...EMPTY_ITEM,
        product_id: String(product.id),
        product_name: product.name,
        product_price: product.price,
        product_image: product.images?.[0] ?? null,
      },
    ]);
    setShowPicker(false);
  };

  const updateItem = (idx, key, value) => {
    setItems((list) => list.map((row, i) => (i === idx ? { ...row, [key]: value } : row)));
  };

  const removeItem = (idx) => setItems((list) => list.filter((_, i) => i !== idx));

  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Kit name is required.');
    const payloadItems = items
      .filter((r) => r.product_id)
      .map((r, i) => ({
        product_id: Number(r.product_id),
        is_required: !!r.is_required,
        item_label: r.item_label.trim() || null,
        note: r.note.trim() || null,
        sort_order: i,
      }));
    if (!payloadItems.length) return setError('Add at least one product to the kit.');
    try {
      const body = {
        name: name.trim(),
        slug: slug.trim() || undefined,
        description: description.trim() || null,
        leader_note: leaderNote.trim() || null,
        image_url: imageUrl.trim() || null,
        is_published: published,
        items: payloadItems,
      };
      if (isNew) await createKit.mutateAsync(body);
      else await updateKit.mutateAsync({ id: kitId, ...body });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save kit.');
    }
  };

  if (!isNew && isLoading) {
    return (
      <Modal open onClose={onClose} title="Edit kit" maxWidth="max-w-3xl">
        <p className="text-sm text-muted">Loading…</p>
      </Modal>
    );
  }

  return (
    <Modal open onClose={pending ? undefined : onClose} title={isNew ? 'New kit template' : 'Edit kit template'} maxWidth="max-w-3xl">
      <form onSubmit={save}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-bold">Kit name *</span>
            <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Pathfinder Class A" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-bold">URL slug</span>
            <input className="input-field font-mono text-sm" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="pathfinder-class-a" />
            <p className="mt-1 text-xs text-muted">Use lowercase letters, numbers and hyphens (e.g. pathfinder-class-a).</p>
          </label>
          <label className="flex items-center gap-2 self-end text-sm font-medium">
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="h-4 w-4 accent-brand-green" />
            Published (shareable landing page)
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-bold">Description (shown to members)</span>
            <textarea className="input-field min-h-[72px] resize-y" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-bold">Leader note (optional)</span>
            <textarea className="input-field min-h-[56px] resize-y" value={leaderNote} onChange={(e) => setLeaderNote(e.target.value)} placeholder="Tips for club leaders ordering for new members" />
          </label>
          <KitCoverImageField value={imageUrl} onChange={setImageUrl} />
        </div>

        {shareUrl && (
          <p className="mt-3 rounded-lg bg-brand-green/10 px-3 py-2 text-xs text-brand-green">
            Share link: <span className="font-mono">{shareUrl}</span>
          </p>
        )}

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Kit products</p>
            <button type="button" onClick={() => setShowPicker((v) => !v)} className="text-xs font-bold text-brand-green">
              {showPicker ? 'Close search' : '+ Add product'}
            </button>
          </div>
          {showPicker && <ProductPicker onPick={addProduct} />}

          <div className="mt-3 max-h-[40vh] space-y-2 overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-sm text-muted">No products yet — search and add items members need.</p>
            ) : (
              items.map((row, idx) => (
                <div key={`${row.product_id}-${idx}`} className="rounded-xl border border-black/8 p-3 dark:border-white/10">
                  <div className="flex items-start gap-3">
                    <ProductImage src={row.product_image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{row.product_name}</p>
                      {row.product_price != null && (
                        <p className="text-xs text-muted">{formatPrice(row.product_price)}</p>
                      )}
                    </div>
                    <button type="button" onClick={() => removeItem(idx)} className="text-xs font-bold text-brand-red">
                      Remove
                    </button>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <input
                      className="input-field py-2 text-sm"
                      placeholder="Display label (optional)"
                      value={row.item_label}
                      onChange={(e) => updateItem(idx, 'item_label', e.target.value)}
                    />
                    <input
                      className="input-field py-2 text-sm"
                      placeholder="Note (optional)"
                      value={row.note}
                      onChange={(e) => updateItem(idx, 'note', e.target.value)}
                    />
                    <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={!!row.is_required}
                        onChange={(e) => updateItem(idx, 'is_required', e.target.checked)}
                        className="h-4 w-4 accent-brand-green"
                      />
                      Required item
                    </label>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-brand-red">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={pending} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? 'Saving…' : 'Save kit'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminKitsPage() {
  const { data: kits = [], isLoading } = useAdminKits();
  const deleteKit = useDeleteKit();
  const [editorId, setEditorId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pageError, setPageError] = useState('');

  const sorted = useMemo(
    () => [...kits].sort((a, b) => (a.sort_order - b.sort_order) || String(a.name).localeCompare(String(b.name))),
    [kits]
  );

  const closeEditor = () => {
    setEditorId(null);
    setCreating(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setPageError('');
    try {
      await deleteKit.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setPageError(err.response?.data?.message || 'Could not delete kit.');
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <AdminPageHeader
        title="Kit templates"
        subtitle="Bundle everything a member needs — leaders share a link like /kits/pathfinder-class-a."
        actions={
          <button type="button" onClick={() => setCreating(true)} className="btn-primary">
            + New kit
          </button>
        }
      />

      <AdminPageAlert message={pageError} onDismiss={() => setPageError('')} />

      {isLoading ? (
        <AdminTableSkeleton rows={4} cols={5} />
      ) : (
        <AdminTable
          columns={[
            { key: 'name', label: 'Kit' },
            { key: 'slug', label: 'Share URL' },
            { key: 'status', label: 'Status' },
            { key: 'actions', label: '', className: 'text-right' },
          ]}
        >
          {sorted.length === 0 ? (
            <AdminTableRow>
              <AdminTableCell className="text-muted">No kit templates yet.</AdminTableCell>
              <AdminTableCell />
              <AdminTableCell />
              <AdminTableCell />
            </AdminTableRow>
          ) : (
            sorted.map((k) => (
              <AdminTableRow key={k.id}>
                <AdminTableCell className="font-bold">{k.name}</AdminTableCell>
                <AdminTableCell className="font-mono text-xs text-muted">/kits/{k.slug}</AdminTableCell>
                <AdminTableCell>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${k.is_published ? 'bg-brand-green/15 text-brand-green' : 'bg-black/10 text-muted'}`}>
                    {k.is_published ? 'Published' : 'Draft'}
                  </span>
                </AdminTableCell>
                <AdminTableCell>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setEditorId(k.id)} className="text-xs font-bold text-brand-green">
                      Edit
                    </button>
                    <button type="button" onClick={() => setDeleteTarget(k)} className="text-xs font-bold text-brand-red">
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
        <KitEditor key={creating ? 'new' : editorId} kitId={creating ? null : editorId} onClose={closeEditor} onSaved={closeEditor} />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete kit template?"
        message={deleteTarget ? `Delete "${deleteTarget.name}"? The share link will stop working.` : ''}
        confirmLabel="Delete"
        loading={deleteKit.isPending}
      />
    </div>
  );
}
