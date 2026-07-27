import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { hasAnyPermission, hasPermission } from '../../lib/permissions';
import {
  policyDownloadUrl,
  useAdminLegalPolicies,
  useCreateLegalPolicy,
  useDeleteLegalPolicy,
  useDeleteLegalPolicyAttachment,
  useUpdateLegalPolicy,
  useUploadLegalPolicyAttachment,
} from '../../hooks/storefront';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminPageAlert from '../../components/admin/AdminPageAlert';
import AdminTable, { AdminTableCell, AdminTableRow } from '../../components/admin/AdminTable';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import Modal from '../../components/dashboard/Modal';
import { AdminTableSkeleton } from '../../components/ui/Skeleton';
import PolicyRichTextEditor from '../../components/legal/PolicyRichTextEditor';
import { normalizePolicyBody } from '../../lib/policyHtml';

function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function emptyPolicy() {
  return {
    slug: '',
    title: '',
    body: '',
    is_published: false,
    show_in_footer: true,
    sort_order: 0,
  };
}

function PolicyModal({
  policy,
  onClose,
  onSave,
  loading,
  canManage,
  onUploadAttachment,
  onRemoveAttachment,
  uploadingAttachment,
}) {
  const [form, setForm] = useState(policy?.id ? { ...policy } : emptyPolicy());
  const [slugTouched, setSlugTouched] = useState(!!policy?.id);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const onTitle = (value) => {
    set('title', value);
    if (!slugTouched && !policy?.id) {
      set('slug', slugify(value));
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.title?.trim() || !form.slug?.trim()) return;
    const body = normalizePolicyBody(form.body || '');
    if (!body.replace(/<[^>]+>/g, '').trim()) return;
    onSave({
      slug: form.slug.trim(),
      title: form.title.trim(),
      body,
      is_published: !!form.is_published,
      show_in_footer: !!form.show_in_footer,
      sort_order: Number(form.sort_order) || 0,
    });
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !policy?.id) return;
    await onUploadAttachment(policy.id, file);
  };

  return (
    <Modal open onClose={loading || uploadingAttachment ? undefined : onClose} title={policy?.id ? 'Edit policy' : 'New policy'} maxWidth="max-w-3xl">
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block font-bold">Title</span>
          <input className="input-field w-full" value={form.title} onChange={(e) => onTitle(e.target.value)} required disabled={!canManage} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-bold">URL slug</span>
          <input
            className="input-field w-full font-mono text-sm"
            value={form.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set('slug', e.target.value);
            }}
            placeholder="returns"
            required
            disabled={!canManage}
          />
          <p className="mt-1 text-xs text-muted">Storefront URL: /policies/{form.slug || '…'}</p>
        </label>
        <div className="block text-sm">
          <span className="mb-1 block font-bold">Body</span>
          <PolicyRichTextEditor
            value={form.body}
            onChange={(html) => set('body', html)}
            disabled={!canManage}
          />
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-bold">Sort order</span>
          <input type="number" className="input-field w-24" value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} disabled={!canManage} />
        </label>
        <div className="flex flex-wrap gap-6">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={!!form.is_published} onChange={(e) => set('is_published', e.target.checked)} className="h-4 w-4 accent-brand-green" disabled={!canManage} />
            Published (visible on storefront)
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={!!form.show_in_footer} onChange={(e) => set('show_in_footer', e.target.checked)} className="h-4 w-4 accent-brand-green" disabled={!canManage} />
            Show in footer
          </label>
        </div>

        {policy?.id ? (
          <div className="rounded-xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <p className="text-sm font-bold">Downloadable file (optional)</p>
            <p className="mt-1 text-xs text-muted">
              Upload a PDF or Word file people can download (recommended for Seller handbook).
              Staff with <strong>Update all legal policies</strong> permission can change this.
            </p>
            {policy.has_download ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <a
                  href={policyDownloadUrl(policy.slug)}
                  className="text-sm font-bold text-brand-green hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {policy.attachment_name || 'Download current file'}
                </a>
                {canManage && (
                  <button
                    type="button"
                    className="text-xs font-bold text-brand-red"
                    disabled={uploadingAttachment}
                    onClick={() => onRemoveAttachment(policy.id)}
                  >
                    Remove file
                  </button>
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted">No file uploaded yet.</p>
            )}
            {canManage && (
              <label className="mt-3 inline-flex cursor-pointer rounded-lg border border-brand-green/40 bg-brand-green/10 px-3 py-2 text-xs font-bold text-brand-green hover:bg-brand-green/15">
                {uploadingAttachment ? 'Uploading…' : policy.has_download ? 'Replace file' : 'Upload PDF / Word'}
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  disabled={uploadingAttachment}
                  onChange={onFile}
                />
              </label>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted">Save the policy first, then you can upload a downloadable file.</p>
        )}

        <div className="flex justify-end gap-3 border-t border-black/10 pt-4 dark:border-white/10">
          <button type="button" onClick={onClose} disabled={loading || uploadingAttachment} className="btn-ghost">Cancel</button>
          {canManage && (
            <button type="submit" disabled={loading || !form.title?.trim() || !form.slug?.trim()} className="btn-primary">
              {loading ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

export default function AdminLegalPoliciesPage() {
  const user = useAuthStore((s) => s.user);
  const canView = hasAnyPermission(user, ['view_legal_policies', 'manage_legal_policies']);
  const canManage = hasPermission(user, 'manage_legal_policies');
  const { data: policies = [], isLoading } = useAdminLegalPolicies(!!user && canView);

  if (user && !canView) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  const createPolicy = useCreateLegalPolicy();
  const updatePolicy = useUpdateLegalPolicy();
  const deletePolicy = useDeleteLegalPolicy();
  const uploadAttachment = useUploadLegalPolicyAttachment();
  const deleteAttachment = useDeleteLegalPolicyAttachment();

  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pageError, setPageError] = useState('');
  const [pageSuccess, setPageSuccess] = useState('');

  const publishedCount = useMemo(() => policies.filter((p) => p.is_published).length, [policies]);

  const openModal = (row) => {
    if (row?.id) {
      const fresh = policies.find((p) => p.id === row.id) || row;
      setModal(fresh);
    } else {
      setModal({});
    }
  };

  const toggleField = async (row, field) => {
    if (!canManage) return;
    setPageError('');
    try {
      await updatePolicy.mutateAsync({ id: row.id, ...row, [field]: !row[field] });
    } catch {
      setPageError('Could not update policy.');
    }
  };

  const savePolicy = async (payload) => {
    if (!canManage) return;
    setPageError('');
    try {
      if (modal?.id) {
        const res = await updatePolicy.mutateAsync({ id: modal.id, ...payload });
        const next = res.policy || { ...modal, ...payload };
        setModal(next);
        setPageSuccess('Policy saved. You can upload or replace a download file below.');
      } else {
        const res = await createPolicy.mutateAsync(payload);
        const created = res.policy;
        if (created?.id) {
          setModal(created);
          setPageSuccess('Policy created. Upload a download file below if needed.');
        } else {
          setModal(null);
          setPageSuccess('Policy created.');
        }
      }
      setTimeout(() => setPageSuccess(''), 5000);
    } catch (err) {
      setPageError(err.response?.data?.message || 'Could not save policy.');
    }
  };

  const onUploadAttachment = async (id, file) => {
    setPageError('');
    try {
      const res = await uploadAttachment.mutateAsync({ id, file });
      setModal(res.policy || modal);
      setPageSuccess('Download file uploaded.');
      setTimeout(() => setPageSuccess(''), 4000);
    } catch (err) {
      setPageError(err.response?.data?.message || 'Could not upload file.');
    }
  };

  const onRemoveAttachment = async (id) => {
    setPageError('');
    try {
      const res = await deleteAttachment.mutateAsync(id);
      setModal(res.policy || { ...modal, has_download: false, attachment_name: null });
      setPageSuccess('Download file removed.');
      setTimeout(() => setPageSuccess(''), 4000);
    } catch (err) {
      setPageError(err.response?.data?.message || 'Could not remove file.');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !canManage) return;
    setPageError('');
    try {
      await deletePolicy.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      setPageError('Could not delete policy.');
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <AdminPageHeader
        title="Legal policies"
        subtitle={`Returns, privacy, terms, seller handbook, and more — ${publishedCount} published. Staff need “Update all legal policies” to edit text or upload downloads.`}
        actions={
          canManage ? (
            <button type="button" onClick={() => openModal({})} className="btn-primary px-4 py-2 text-sm">
              + Add policy
            </button>
          ) : null
        }
      />

      <AdminPageAlert message={pageError} onDismiss={() => setPageError('')} />
      {pageSuccess && (
        <p className="mb-4 rounded-xl border border-brand-green/30 bg-brand-green/10 px-4 py-3 text-sm font-medium text-brand-green">
          {pageSuccess}
        </p>
      )}

      {isLoading ? (
        <AdminTableSkeleton rows={4} cols={7} />
      ) : (
        <AdminTable
          columns={[
            { key: 'pub', label: 'Published' },
            { key: 'footer', label: 'Footer' },
            { key: 'title', label: 'Title' },
            { key: 'slug', label: 'Slug' },
            { key: 'file', label: 'Download' },
            { key: 'order', label: 'Order' },
            { key: 'actions', label: '', className: 'text-right' },
          ]}
        >
          {policies.map((p) => (
            <AdminTableRow key={p.id}>
              <AdminTableCell>
                <input
                  type="checkbox"
                  checked={!!p.is_published}
                  disabled={!canManage || updatePolicy.isPending}
                  onChange={() => toggleField(p, 'is_published')}
                  className="h-4 w-4 accent-brand-green"
                  aria-label={`Published: ${p.title}`}
                />
              </AdminTableCell>
              <AdminTableCell>
                <input
                  type="checkbox"
                  checked={!!p.show_in_footer}
                  disabled={!canManage || updatePolicy.isPending}
                  onChange={() => toggleField(p, 'show_in_footer')}
                  className="h-4 w-4 accent-brand-green"
                  aria-label={`Footer: ${p.title}`}
                />
              </AdminTableCell>
              <AdminTableCell className="font-bold">{p.title}</AdminTableCell>
              <AdminTableCell>
                {p.is_published ? (
                  <Link to={`/policies/${p.slug}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-brand-green hover:underline">
                    {p.slug}
                  </Link>
                ) : (
                  <span className="font-mono text-xs text-muted">{p.slug}</span>
                )}
              </AdminTableCell>
              <AdminTableCell>
                {p.has_download ? (
                  <a href={policyDownloadUrl(p.slug)} className="text-xs font-bold text-brand-green hover:underline" target="_blank" rel="noreferrer">
                    File
                  </a>
                ) : (
                  <span className="text-xs text-muted">—</span>
                )}
              </AdminTableCell>
              <AdminTableCell className="text-muted">{p.sort_order}</AdminTableCell>
              <AdminTableCell>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => openModal(p)} className="text-xs font-bold text-brand-green">
                    {canManage ? 'Edit' : 'View'}
                  </button>
                  {canManage && (
                    <button type="button" onClick={() => setDeleteTarget(p)} className="text-xs font-bold text-brand-red">
                      Delete
                    </button>
                  )}
                </div>
              </AdminTableCell>
            </AdminTableRow>
          ))}
        </AdminTable>
      )}

      {modal && (
        <PolicyModal
          key={modal.id || 'new'}
          policy={modal.id ? (policies.find((p) => p.id === modal.id) || modal) : null}
          onClose={() => setModal(null)}
          onSave={savePolicy}
          loading={createPolicy.isPending || updatePolicy.isPending}
          canManage={canManage}
          onUploadAttachment={onUploadAttachment}
          onRemoveAttachment={onRemoveAttachment}
          uploadingAttachment={uploadAttachment.isPending || deleteAttachment.isPending}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete policy?"
        message={deleteTarget ? `Remove "${deleteTarget.title}"? This cannot be undone.` : ''}
        confirmLabel="Delete"
        loading={deletePolicy.isPending}
      />
    </div>
  );
}
