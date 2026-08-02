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

/** Split comma / newline / semicolon lists into names. */
function parseBulkNames(raw) {
  return String(raw || '')
    .split(/[\n\r,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((name, i, arr) => arr.findIndex((x) => x.toLowerCase() === name.toLowerCase()) === i);
}

function CategoryEditModal({ category, flat, guides, onClose, onSave, loading }) {
  const [name, setName] = useState(category?.name || '');
  const [parentId, setParentId] = useState(
    category?.parent_id != null ? String(category.parent_id) : ''
  );
  const [sizeGuideId, setSizeGuideId] = useState(
    category?.size_guide_id != null ? String(category.size_guide_id) : ''
  );

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      parent_id: parentId ? Number(parentId) : null,
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
        <label className="mb-4 block text-sm">
          <span className="mb-1 block font-bold">Parent category</span>
          <select
            className="admin-filter-select w-full"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
          >
            <option value="">None (top level)</option>
            {flat
              .filter((c) => c.id !== category?.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {'—'.repeat(c.depth)}
                  {c.name}
                </option>
              ))}
          </select>
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
  const [namesText, setNamesText] = useState('');
  const [parentId, setParentId] = useState('');
  const [formError, setFormError] = useState('');
  const [pageAlert, setPageAlert] = useState('');
  const [pageError, setPageError] = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const flat = useMemo(() => flattenCategories(data?.data || []), [data]);
  const byId = useMemo(() => Object.fromEntries(flat.map((c) => [c.id, c])), [flat]);
  const guideById = useMemo(() => Object.fromEntries(guides.map((g) => [g.id, g.name])), [guides]);
  const previewNames = useMemo(() => parseBulkNames(namesText), [namesText]);
  const parentLabel = parentId ? byId[Number(parentId)]?.name : null;

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    setPageAlert('');
    const names = parseBulkNames(namesText);
    if (names.length === 0) {
      setFormError('Enter at least one category name.');
      return;
    }
    try {
      const res = await createCat.mutateAsync({
        names,
        parent_id: parentId ? Number(parentId) : null,
      });
      const count = res.created ?? names.length;
      setNamesText('');
      setPageAlert(
        count === 1
          ? `Category "${names[0]}" created${parentLabel ? ` under ${parentLabel}` : ''}.`
          : `${count} categories created${parentLabel ? ` under ${parentLabel}` : ''}.`
      );
    } catch (err) {
      setFormError(err.response?.data?.message || 'Could not create categories.');
    }
  };

  const addUnder = (category) => {
    setParentId(String(category.id));
    setFormError('');
    setPageAlert(`Adding under “${category.name}”. Enter one or more subcategory names below.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const confirmEdit = async ({ name, parent_id, size_guide_id }) => {
    if (!editTarget) return;
    setPageError('');
    try {
      await updateCat.mutateAsync({ id: editTarget.id, name, parent_id, size_guide_id });
      setEditTarget(null);
      setPageAlert(`Updated “${name}”.`);
    } catch (err) {
      setPageError(err.response?.data?.message || 'Could not update category.');
      setEditTarget(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setPageError('');
    try {
      await deleteCat.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      setPageAlert(`Deleted “${deleteTarget.name}”.`);
    } catch (err) {
      setPageError(err.response?.data?.message || 'Could not delete category.');
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <AdminPageHeader
        title="Categories"
        subtitle="Create top-level groups or nest subcategories. Paste several names at once to add in bulk."
      />

      <AdminPageAlert type="success" message={pageAlert} onDismiss={() => setPageAlert('')} />
      <AdminPageAlert message={pageError} onDismiss={() => setPageError('')} />

      <form onSubmit={submit} className="admin-panel mb-6 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-bold">
              Category name(s)
              {previewNames.length > 1 ? (
                <span className="ml-2 font-semibold text-brand-green">({previewNames.length} will be created)</span>
              ) : null}
            </span>
            <textarea
              className="input-field min-h-[96px] w-full"
              placeholder={'One name, or many separated by commas or new lines\n\nExample:\nFashion, Groceries, Provisions\n\nor under Clothes:\nKids clothes\nMen\'s clothes\nWomen\'s clothes'}
              value={namesText}
              onChange={(e) => setNamesText(e.target.value)}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-bold">Parent category (optional)</span>
            <select
              className="admin-filter-select w-full"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">None — create as top-level</option>
              {flat.map((c) => (
                <option key={c.id} value={c.id}>
                  {'—'.repeat(c.depth)}
                  {c.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted">
              {parentId
                ? `New items will be saved under “${parentLabel || 'selected parent'}”.`
                : 'Leave empty for top-level categories like Fashion or Groceries.'}
            </p>
          </label>
        </div>
        {formError && <p className="text-sm text-brand-red">{formError}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={createCat.isPending} className="btn-primary">
            {createCat.isPending
              ? 'Saving…'
              : previewNames.length > 1
                ? `+ Add ${previewNames.length} categories`
                : '+ Add category'}
          </button>
          {parentId && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setParentId('')}
            >
              Clear parent
            </button>
          )}
        </div>
      </form>

      {isLoading ? (
        <AdminTableSkeleton rows={5} cols={5} />
      ) : (
        <AdminTable
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'slug', label: 'Slug' },
            { key: 'parent', label: 'Parent' },
            { key: 'guide', label: 'Size guide' },
            { key: 'actions', label: '', className: 'text-right' },
          ]}
        >
          {flat.map((c) => (
            <AdminTableRow key={c.id}>
              <AdminTableCell className="font-bold" style={{ paddingLeft: `${12 + c.depth * 16}px` }}>
                {c.name}
              </AdminTableCell>
              <AdminTableCell className="text-muted">{c.slug}</AdminTableCell>
              <AdminTableCell className="text-muted">
                {c.parent_id ? byId[c.parent_id]?.name || `#${c.parent_id}` : '—'}
              </AdminTableCell>
              <AdminTableCell className="text-muted">
                {c.size_guide_id ? guideById[c.size_guide_id] || `#${c.size_guide_id}` : '—'}
              </AdminTableCell>
              <AdminTableCell>
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={() => addUnder(c)} className="text-xs font-bold text-brand-green">
                    Add under
                  </button>
                  <button type="button" onClick={() => setEditTarget(c)} className="text-xs font-bold text-brand-green">
                    Edit
                  </button>
                  <button type="button" onClick={() => setDeleteTarget(c)} className="text-xs font-bold text-brand-red">
                    Delete
                  </button>
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
          flat={flat}
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
        message={
          deleteTarget
            ? `Delete category "${deleteTarget.name}"? Remove subcategories first if any exist. Products in this category may need to be reassigned.`
            : ''
        }
        confirmLabel="Delete"
        loading={deleteCat.isPending}
      />
    </div>
  );
}
