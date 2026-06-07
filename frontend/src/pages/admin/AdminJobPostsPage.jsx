import { useMemo, useState } from 'react';
import {
  useAdminJobPosts,
  useCompanySettings,
  useCreateJobPost,
  useDeleteJobPost,
  useJobRoleTypes,
  useUpdateJobPost,
} from '../../hooks/admin';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminPageAlert from '../../components/admin/AdminPageAlert';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import Modal from '../../components/dashboard/Modal';
import RoleTypeCombobox, { templateSlugForRole } from '../../components/admin/RoleTypeCombobox';
import { AdminTableSkeleton } from '../../components/ui/Skeleton';
import {
  cloneDefaultFields,
  DRIVER_JOB_TEMPLATE,
  DRIVER_ROLE_NOTE,
  FIELD_TYPES,
  fieldTypeLabel,
  newCustomField,
  STATION_JOB_TEMPLATE,
  WAREHOUSE_JOB_TEMPLATE,
} from '../../lib/careers';

const TEMPLATES = {
  driver: DRIVER_JOB_TEMPLATE,
  warehouse: WAREHOUSE_JOB_TEMPLATE,
  station_coordinator: STATION_JOB_TEMPLATE,
};

function emptyForm() {
  return {
    title: '',
    city: '',
    job_type_label: 'Warehouse assistant',
    description: WAREHOUSE_JOB_TEMPLATE,
    is_active: true,
    fields: cloneDefaultFields(),
  };
}

function JobFieldRow({ field, index, total, onChange, onRemove, onMove }) {
  const set = (key, value) => onChange({ ...field, [key]: value });
  const isFile = field.field_type === 'file';
  const isSelect = field.field_type === 'select';

  return (
    <div className="rounded-xl border border-black/10 p-4 dark:border-white/10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">
          Field {index + 1} · {fieldTypeLabel(field.field_type)}
        </p>
        <div className="flex gap-1">
          <button type="button" disabled={index === 0} onClick={() => onMove(index, -1)} className="btn-ghost px-2 py-1 text-xs">↑</button>
          <button type="button" disabled={index >= total - 1} onClick={() => onMove(index, 1)} className="btn-ghost px-2 py-1 text-xs">↓</button>
          <button type="button" onClick={onRemove} className="text-xs font-bold text-brand-red hover:underline">Remove</button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-bold">Label</span>
          <input className="input-field w-full" value={field.label} onChange={(e) => set('label', e.target.value)} required />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-bold">Type</span>
          <select className="admin-filter-select w-full" value={field.field_type} onChange={(e) => set('field_type', e.target.value)}>
            {FIELD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-2 self-end text-sm font-semibold">
          <input type="checkbox" checked={!!field.is_required} onChange={(e) => set('is_required', e.target.checked)} className="h-4 w-4 accent-brand-green" />
          Required (compulsory)
        </label>
        {!isFile && (
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-bold">Placeholder</span>
            <input className="input-field w-full" value={field.placeholder || ''} onChange={(e) => set('placeholder', e.target.value)} />
          </label>
        )}
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-bold">Help text</span>
          <input className="input-field w-full" value={field.help_text || ''} onChange={(e) => set('help_text', e.target.value)} placeholder="Shown under the field on the apply form" />
        </label>
        {isSelect && (
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-bold">Dropdown options</span>
            <input
              className="input-field w-full"
              value={(field.options || []).join(', ')}
              onChange={(e) => set('options', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
              placeholder="Option A, Option B, Option C"
            />
          </label>
        )}
        {isFile && (
          <>
            <label className="block text-sm">
              <span className="mb-1 block font-bold">Max file size (MB)</span>
              <input type="number" min={1} max={20} className="input-field w-full" value={field.max_file_mb || 5} onChange={(e) => set('max_file_mb', Number(e.target.value) || 5)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-bold">Allowed extensions</span>
              <input className="input-field w-full" value={field.accepted_extensions || 'pdf,doc,docx'} onChange={(e) => set('accepted_extensions', e.target.value)} placeholder="pdf,doc,docx,jpg" />
            </label>
          </>
        )}
      </div>
    </div>
  );
}

function JobPostModal({ job, driverHiringEnabled, roleTypes, onClose, onSave, loading }) {
  const [form, setForm] = useState(
    job
      ? {
          title: job.title,
          city: job.city,
          job_type_label: job.job_type_label || job.job_type,
          description: job.description,
          is_active: job.is_active,
          fields: (job.fields?.length ? job.fields : cloneDefaultFields()).map((f, i) => ({
            ...f,
            sort_order: i + 1,
          })),
        }
      : emptyForm()
  );
  const [selectedSlug, setSelectedSlug] = useState(job?.job_type ?? null);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const onRoleLabelChange = (label) => {
    const slug = templateSlugForRole(label, roleTypes);
    const template = TEMPLATES[slug];
    setForm((f) => ({
      ...f,
      job_type_label: label,
      description: template && (!job || f.description === TEMPLATES[selectedSlug]) ? template : f.description,
    }));
    setSelectedSlug(slug);
  };

  const isDriverRole =
    roleTypes.find((r) => r.label === form.job_type_label)?.is_driver
    || roleTypes.find((r) => r.slug === selectedSlug)?.is_driver
    || selectedSlug === 'driver';

  const updateField = (index, next) => {
    setForm((f) => {
      const fields = [...f.fields];
      fields[index] = next;
      return { ...f, fields };
    });
  };

  const removeField = (index) => {
    setForm((f) => ({ ...f, fields: f.fields.filter((_, i) => i !== index) }));
  };

  const moveField = (index, dir) => {
    setForm((f) => {
      const fields = [...f.fields];
      const target = index + dir;
      if (target < 0 || target >= fields.length) return f;
      [fields[index], fields[target]] = [fields[target], fields[index]];
      return { ...f, fields: fields.map((field, i) => ({ ...field, sort_order: i + 1 })) };
    });
  };

  const addField = () => {
    setForm((f) => ({
      ...f,
      fields: [...f.fields, newCustomField(f.fields.length + 1)],
    }));
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.city.trim() || !form.description.trim() || !form.fields.length) return;
    if (!form.job_type_label.trim()) return;
    if (form.fields.some((f) => !f.label.trim())) return;
    onSave({
      title: form.title.trim(),
      city: form.city.trim(),
      job_type_label: form.job_type_label.trim(),
      description: form.description.trim(),
      is_active: form.is_active,
      fields: form.fields.map((f, i) => ({
        field_key: f.field_key || '',
        label: f.label.trim(),
        field_type: f.field_type,
        is_required: !!f.is_required,
        sort_order: i + 1,
        placeholder: f.placeholder || '',
        help_text: f.help_text || '',
        options: f.options || [],
        max_file_mb: f.max_file_mb || 5,
        accepted_extensions: f.accepted_extensions || 'pdf,doc,docx',
      })),
    });
  };

  return (
    <Modal open onClose={loading ? undefined : onClose} title={job ? 'Edit job post' : 'New job post'} maxWidth="max-w-3xl">
      <form onSubmit={submit} className="max-h-[75vh] space-y-4 overflow-y-auto pr-1">
        {!driverHiringEnabled && (
          <p className="rounded-lg bg-brand-gold/10 px-3 py-2 text-xs text-[#7c4a03]">
            Driver hiring is off in Company Settings — only warehouse and station roles can be posted.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-bold">Title</span>
            <input className="input-field w-full" value={form.title} onChange={(e) => set('title', e.target.value)} required />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-bold">City</span>
            <input className="input-field w-full" value={form.city} onChange={(e) => set('city', e.target.value)} required />
          </label>
        </div>
        <RoleTypeCombobox
          value={form.job_type_label}
          onChange={onRoleLabelChange}
          onRoleSlugChange={setSelectedSlug}
          roleTypes={
            driverHiringEnabled
              ? roleTypes
              : roleTypes.filter((r) => !r.is_driver)
          }
        />
        {isDriverRole && <p className="text-xs text-muted">{DRIVER_ROLE_NOTE}</p>}
        <label className="block text-sm">
          <span className="mb-1 block font-bold">Description</span>
          <textarea className="input-field min-h-[120px] w-full resize-y" value={form.description} onChange={(e) => set('description', e.target.value)} required />
        </label>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-extrabold">Application form fields</h3>
              <p className="text-xs text-muted">Configure what applicants must fill in. Mark fields as required or optional.</p>
            </div>
            <button type="button" onClick={addField} className="btn-ghost px-3 py-1.5 text-sm">+ Add field</button>
          </div>
          <div className="space-y-3">
            {form.fields.map((field, index) => (
              <JobFieldRow
                key={`${field.field_key}-${index}`}
                field={field}
                index={index}
                total={form.fields.length}
                onChange={(next) => updateField(index, next)}
                onRemove={() => removeField(index)}
                onMove={moveField}
              />
            ))}
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} className="h-4 w-4 accent-brand-green" />
          Active (visible on careers pages)
        </label>
        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-black/10 bg-white pt-3 dark:bg-[#1E1E1E]">
          <button type="button" onClick={onClose} disabled={loading} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Saving…' : job ? 'Save changes' : 'Create post'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminJobPostsPage() {
  const { data, isLoading, isError } = useAdminJobPosts();
  const { data: roleTypes = [] } = useJobRoleTypes();
  const { data: settingsData } = useCompanySettings();
  const createPost = useCreateJobPost();
  const updatePost = useUpdateJobPost();
  const deletePost = useDeleteJobPost();

  const posts = data?.data ?? [];
  const driverHiringEnabled = !!settingsData?.driver_hiring_enabled;

  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pageError, setPageError] = useState('');

  const saveJob = async (payload) => {
    setPageError('');
    try {
      if (modal?.id) {
        await updatePost.mutateAsync({ id: modal.id, ...payload });
      } else {
        await createPost.mutateAsync(payload);
      }
      setModal(null);
    } catch (err) {
      setPageError(err.response?.data?.message || 'Could not save job post.');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setPageError('');
    try {
      await deletePost.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      setPageError('Could not delete job post.');
      setDeleteTarget(null);
    }
  };

  const activeCount = useMemo(() => posts.filter((p) => p.is_active).length, [posts]);

  return (
    <div>
      <AdminPageHeader
        title="Job posts"
        subtitle="Create roles and customize the application form for each — CV uploads, required fields, and more."
        actions={
          <button type="button" onClick={() => setModal({})} className="btn-primary px-4 py-2 text-sm">
            New post
          </button>
        }
      />

      <AdminPageAlert message={pageError} onDismiss={() => setPageError('')} />

      <p className="mb-4 text-sm text-muted">{activeCount} active · {posts.length} total</p>

      {isLoading ? (
        <AdminTableSkeleton rows={4} cols={3} />
      ) : isError ? (
        <p className="text-sm text-brand-red">Could not load job posts. Run migrate-phase-m2-fields.php if forms are missing.</p>
      ) : posts.length === 0 ? (
        <p className="admin-panel text-sm text-muted">No job posts yet. Create one to appear on /careers.</p>
      ) : (
        <ul className="space-y-2">
          {posts.map((post) => (
            <li key={post.id} className="admin-panel flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {!post.is_active && (
                    <span className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-bold uppercase dark:bg-white/10">Hidden</span>
                  )}
                  <p className="font-bold">{post.title}</p>
                </div>
                <p className="text-sm text-muted">
                  {post.job_type_label} · {post.city}
                  {(post.fields?.length ?? 0) > 0 && ` · ${post.fields.length} form field(s)`}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => setModal(post)} className="btn-ghost px-3 py-1.5 text-sm">
                  Edit
                </button>
                <button type="button" onClick={() => setDeleteTarget(post)} className="text-sm font-bold text-brand-red hover:underline">
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modal !== null && (
        <JobPostModal
          job={modal.id ? modal : null}
          driverHiringEnabled={driverHiringEnabled}
          roleTypes={roleTypes}
          onClose={() => setModal(null)}
          onSave={saveJob}
          loading={createPost.isPending || updatePost.isPending}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete job post?"
        message={deleteTarget ? `Delete “${deleteTarget.title}”? Applications already received are kept.` : ''}
        confirmLabel="Delete"
        loading={deletePost.isPending}
      />
    </div>
  );
}
