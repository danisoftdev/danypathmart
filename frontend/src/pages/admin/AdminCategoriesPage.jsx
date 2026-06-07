import { useMemo, useState } from 'react';
import { useCategories } from '../../hooks/catalog';
import { useCreateCategory, useDeleteCategory, useSizeGuides, useUpdateCategory } from '../../hooks/admin';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminTable, { AdminTableCell, AdminTableRow } from '../../components/admin/AdminTable';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import AdminPageAlert from '../../components/admin/AdminPageAlert';
import Modal from '../../components/dashboard/Modal';
import { AdminTableSkeleton } from '../../components/ui/Skeleton';

function flattenCategories(nodes = [], depth = 0) {
  return nodes.flatMap((n) => [
    { ...n, depth },
    ...flattenCategories(n.children || [], depth + 1),
  ]);
}

function CategoryEditModal({ category, guides, onClose, onSave, loading }) {
  const [name, setName] = useState(category?.name || '');
  const [sizeGuideId, setSizeGuideId] = useState(
    category?.size_guide_id != null ? String(category.size_guide_id) : ''
  );

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      size_guide_id: sizeGuideId ? Number(sizeGuideId) : null,
    });
  };

  return (
    <Modal open onClose={loading ? undefined : onClose} title="Edit category" maxWidth="max-w-md">
      <form onSubmit={submit}>
        <label className="mb-4 block text-sm">
          <span className="mb-1 block font-bold">Category name</span>
          <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <label className="mb-6 block text-sm">
          <span className="mb-1 block font-bold">Size guide (product line)</span>
          <select
            className="admin-filter-select w-full"
            value={sizeGuideId}
            onChange={(e) => setSizeGuideId(e.target.value)}
          >
            <option value="">None — inherit from parent if set</option>
            {guides.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">Products in this category use this chart unless overridden per product.</p>
        </label>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={loading} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={loading || !name.trim()} className="btn-primary">
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminCategoriesPage() {
  const { data, isLoading } = useCategories();
  const { data: guides = [] } = useSizeGuides();
  const createCat = useCreateCategory();
  const updateCat = useUpdateCategory();
  const deleteCat = useDeleteCategory();
  const [form, setForm] = useState({ name: '', slug: '', parent_id: '' });
  const [formError, setFormError] = useState('');
  const [pageError, setPageError] = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const flat = useMemo(() => flattenCategories(data?.data || []), [data]);
  const guideById = useMemo(() => Object.fromEntries(guides.map((g) => [g.id, g.name])), [guides]);

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) return setFormError('Name is required.');
    try {
      await createCat.mutateAsync({
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        parent_id: form.parent_id ? Number(form.parent_id) : null,
      });
      setForm({ name: '', slug: '', parent_id: '' });
    } catch (err) {
      setFormError(err.response?.data?.message || 'Could not create category.');
    }
  };

  const confirmEdit = async ({ name, size_guide_id }) => {
    if (!editTarget) return;
    setPageError('');
    try {
      await updateCat.mutateAsync({ id: editTarget.id, name, size_guide_id });
      setEditTarget(null);
    } catch {
      setPageError('Could not update category.');
      setEditTarget(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setPageError('');
    try {
      await deleteCat.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setPageError(err.response?.data?.message || 'Could not delete category.');
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <AdminPageHeader title="Categories" subtitle="Organise products into browsable categories." />

      <AdminPageAlert message={pageError} onDismiss={() => setPageError('')} />

      <form onSubmit={submit} className="admin-panel mb-6 grid gap-3 sm:grid-cols-3">
        <input className="input-field" placeholder="Category name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <input className="input-field" placeholder="Slug (optional)" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
        <select className="admin-filter-select" value={form.parent_id} onChange={(e) => setForm((f) => ({ ...f, parent_id: e.target.value }))}>
          <option value="">No parent</option>
          {flat.map((c) => (
            <option key={c.id} value={c.id}>{'—'.repeat(c.depth)}{c.name}</option>
          ))}
        </select>
        {formError && <p className="text-sm text-brand-red sm:col-span-3">{formError}</p>}
        <button type="submit" disabled={createCat.isPending} className="btn-primary sm:col-span-3 sm:w-auto sm:justify-self-start">
          + Add category
        </button>
      </form>

      {isLoading ? (
        <AdminTableSkeleton rows={5} cols={5} />
      ) : (
        <AdminTable columns={[{ key: 'name', label: 'Name' }, { key: 'slug', label: 'Slug' }, { key: 'parent', label: 'Parent' }, { key: 'guide', label: 'Size guide' }, { key: 'actions', label: '', className: 'text-right' }]}>
          {flat.map((c) => (
            <AdminTableRow key={c.id}>
              <AdminTableCell className="font-bold" style={{ paddingLeft: `${12 + c.depth * 16}px` }}>{c.name}</AdminTableCell>
              <AdminTableCell className="text-muted">{c.slug}</AdminTableCell>
              <AdminTableCell className="text-muted">{c.parent_id || '—'}</AdminTableCell>
              <AdminTableCell className="text-muted">{c.size_guide_id ? guideById[c.size_guide_id] || `#${c.size_guide_id}` : '—'}</AdminTableCell>
              <AdminTableCell>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setEditTarget(c)} className="text-xs font-bold text-brand-green">Edit</button>
                  <button type="button" onClick={() => setDeleteTarget(c)} className="text-xs font-bold text-brand-red">Delete</button>
                </div>
              </AdminTableCell>
            </AdminTableRow>
          ))}
        </AdminTable>
      )}

      {editTarget && (
        <CategoryEditModal
          key={editTarget.id}
          category={editTarget}
          guides={guides}
          onClose={() => setEditTarget(null)}
          onSave={confirmEdit}
          loading={updateCat.isPending}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete category?"
        message={deleteTarget ? `Delete category "${deleteTarget.name}"? Products in this category may need to be reassigned.` : ''}
        confirmLabel="Delete"
        loading={deleteCat.isPending}
      />
    </div>
  );
}
