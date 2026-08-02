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

/** Split comma / newline / semicolon lists into unique names. */
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
  const [lastResult, setLastResult] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const flat = useMemo(() => flattenCategories(data?.data || []), [data]);
  const byId = useMemo(() => Object.fromEntries(flat.map((c) => [c.id, c])), [flat]);
  const guideById = useMemo(() => Object.fromEntries(guides.map((g) => [g.id, g.name])), [guides]);
  const previewNames = useMemo(() => parseBulkNames(namesText), [namesText]);
  const parentLabel = parentId ? byId[Number(parentId)]?.name : null;
  const parentKey = parentId ? Number(parentId) : null;

  const siblingNames = useMemo(() => {
    const set = new Set();
    for (const c of flat) {
      const pid = c.parent_id != null ? Number(c.parent_id) : null;
      if (pid === parentKey) {
        set.add(String(c.name).toLowerCase());
      }
    }
    return set;
  }, [flat, parentKey]);

  const preview = useMemo(() => {
    const willCreate = [];
    const alreadyExists = [];
    for (const name of previewNames) {
      if (siblingNames.has(name.toLowerCase())) {
        alreadyExists.push(name);
      } else {
        willCreate.push(name);
      }
    }
    return { willCreate, alreadyExists };
  }, [previewNames, siblingNames]);

  const stats = useMemo(() => {
    const top = flat.filter((c) => c.parent_id == null).length;
    const nested = flat.length - top;
    return { total: flat.length, top, nested };
  }, [flat]);

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    setPageAlert('');
    setPageError('');
    setLastResult(null);
    const names = parseBulkNames(namesText);
    if (names.length === 0) {
      setFormError('Enter at least one category name.');
      return;
    }
    if (preview.willCreate.length === 0) {
      setFormError(
        names.length === 1
          ? `“${names[0]}” already exists${parentLabel ? ` under ${parentLabel}` : ' at the top level'}.`
          : 'All of those names already exist at this level — nothing new to add.'
      );
      return;
    }
    try {
      const res = await createCat.mutateAsync({
        names,
        parent_id: parentId ? Number(parentId) : null,
      });
      const created = res.created ?? res.categories?.length ?? 0;
      const skipped = res.skipped || [];
      setNamesText('');
      setLastResult({
        created,
        skipped,
        parentLabel,
        names: (res.categories || []).map((c) => c.name),
      });
      setPageAlert(res.message || `${created} categor${created === 1 ? 'y' : 'ies'} saved.`);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Could not create categories.');
    }
  };

  const addUnder = (category) => {
    setParentId(String(category.id));
    setFormError('');
    setPageError('');
    setLastResult(null);
    setPageAlert(`Ready to add under “${category.name}”. Paste one or more subcategory names below.`);
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
        subtitle="Organise the catalogue into parents and subcategories. Bulk paste is supported — duplicates at the same level are skipped automatically."
      />

      <AdminPageAlert type="success" message={pageAlert} onDismiss={() => setPageAlert('')} />
      <AdminPageAlert message={pageError} onDismiss={() => setPageError('')} />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="admin-panel px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Total</p>
          <p className="mt-1 text-2xl font-extrabold text-[#111111] dark:text-white">{stats.total}</p>
        </div>
        <div className="admin-panel px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Top level</p>
          <p className="mt-1 text-2xl font-extrabold text-[#111111] dark:text-white">{stats.top}</p>
        </div>
        <div className="admin-panel px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Subcategories</p>
          <p className="mt-1 text-2xl font-extrabold text-[#111111] dark:text-white">{stats.nested}</p>
        </div>
      </div>

      <form onSubmit={submit} className="admin-panel mb-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-black/8 pb-3 dark:border-white/10">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Add categories</h2>
            <p className="mt-1 text-sm text-muted">
              Separate names with commas or new lines. Existing names under the same parent are rejected; only new ones are saved.
            </p>
          </div>
          {parentId && (
            <span className="rounded-full bg-brand-green/10 px-3 py-1 text-xs font-bold text-brand-green">
              Under: {parentLabel}
            </span>
          )}
        </div>

        <div className="grid gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-bold">Category name(s)</span>
            <textarea
              className="input-field min-h-[110px] w-full font-medium"
              placeholder={'Fashion, Groceries, Provisions\n\nor under Fashion:\nMen\'s clothing\nWomen\'s clothing\nKids clothes'}
              value={namesText}
              onChange={(e) => setNamesText(e.target.value)}
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-bold">Parent category</span>
            <select
              className="admin-filter-select w-full"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">None — top level</option>
              {flat.map((c) => (
                <option key={c.id} value={c.id}>
                  {'—'.repeat(c.depth)}
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {previewNames.length > 0 && (
          <div className="rounded-xl border border-black/8 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex flex-wrap gap-3 text-xs font-bold uppercase tracking-wide">
              <span className="text-brand-green">
                Will create: {preview.willCreate.length}
              </span>
              <span className="text-muted">
                Already exist: {preview.alreadyExists.length}
              </span>
            </div>
            {preview.willCreate.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {preview.willCreate.map((name) => (
                  <span
                    key={`new-${name}`}
                    className="rounded-full bg-brand-green/15 px-2.5 py-1 text-xs font-semibold text-brand-green"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}
            {preview.alreadyExists.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {preview.alreadyExists.map((name) => (
                  <span
                    key={`skip-${name}`}
                    className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-semibold text-muted line-through dark:bg-white/10"
                    title="Already exists at this level"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {lastResult && (
          <div className="rounded-xl border border-brand-green/25 bg-brand-green/5 px-3 py-3 text-sm">
            <p className="font-bold text-brand-green">
              {lastResult.created} added
              {lastResult.parentLabel ? ` under ${lastResult.parentLabel}` : ' at top level'}
              {lastResult.skipped.length > 0 ? ` · ${lastResult.skipped.length} skipped` : ''}
            </p>
            {lastResult.names.length > 0 && (
              <p className="mt-1 text-muted">
                Created: {lastResult.names.join(', ')}
              </p>
            )}
            {lastResult.skipped.length > 0 && (
              <p className="mt-1 text-muted">
                Skipped (already exist): {lastResult.skipped.join(', ')}
              </p>
            )}
          </div>
        )}

        {formError && <p className="text-sm font-semibold text-brand-red">{formError}</p>}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={createCat.isPending || preview.willCreate.length === 0}
            className="btn-primary"
          >
            {createCat.isPending
              ? 'Saving…'
              : preview.willCreate.length > 1
                ? `Add ${preview.willCreate.length} new categories`
                : preview.willCreate.length === 1
                  ? 'Add category'
                  : 'Add category'}
          </button>
          {parentId && (
            <button type="button" className="btn-ghost" onClick={() => setParentId('')}>
              Clear parent
            </button>
          )}
        </div>
      </form>

      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Category tree</h2>
          <p className="mt-0.5 text-xs text-muted">Indented rows are subcategories. Use Add under to nest quickly.</p>
        </div>
      </div>

      {isLoading ? (
        <AdminTableSkeleton rows={5} cols={5} />
      ) : flat.length === 0 ? (
        <div className="admin-panel px-4 py-10 text-center text-sm text-muted">
          No categories yet. Add your first top-level groups above.
        </div>
      ) : (
        <AdminTable
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'level', label: 'Level' },
            { key: 'slug', label: 'Slug' },
            { key: 'parent', label: 'Parent' },
            { key: 'guide', label: 'Size guide' },
            { key: 'actions', label: '', className: 'text-right' },
          ]}
        >
          {flat.map((c) => (
            <AdminTableRow key={c.id}>
              <AdminTableCell className="font-bold" style={{ paddingLeft: `${12 + c.depth * 18}px` }}>
                <span className="inline-flex items-center gap-2">
                  {c.depth > 0 && (
                    <span className="text-xs font-normal text-muted" aria-hidden>
                      └
                    </span>
                  )}
                  {c.name}
                </span>
              </AdminTableCell>
              <AdminTableCell>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    c.depth === 0
                      ? 'bg-brand-gold/20 text-[#92400E]'
                      : 'bg-black/5 text-muted dark:bg-white/10'
                  }`}
                >
                  {c.depth === 0 ? 'Parent' : `Child L${c.depth}`}
                </span>
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
