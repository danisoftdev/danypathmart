import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { hasAnyPermission, hasPermission } from '../../lib/permissions';
import {
  useAdminHeroBanners,
  useCreateHeroBanner,
  useDeleteHeroBanner,
  useUpdateHeroBanner,
} from '../../hooks/storefront';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminPageAlert from '../../components/admin/AdminPageAlert';
import AdminTable, { AdminTableCell, AdminTableRow } from '../../components/admin/AdminTable';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import HeroImageUploadField from '../../components/admin/HeroImageUploadField';
import Modal from '../../components/dashboard/Modal';
import { AdminTableSkeleton } from '../../components/ui/Skeleton';
import { resolveImageUrl } from '../../lib/currency';

const THEMES = [
  { value: 'green', label: 'Green' },
  { value: 'gold', label: 'Gold' },
  { value: 'forest', label: 'Forest' },
];

function emptyBanner() {
  return {
    kicker: '',
    title: '',
    subtitle: '',
    cta_label: 'Shop now',
    link_to: '/shop',
    image_url: '',
    theme: 'green',
    is_active: true,
    sort_order: 0,
  };
}

function BannerModal({ banner, onClose, onSave, loading, canManage }) {
  const [form, setForm] = useState(banner?.id ? { ...banner, image_url: banner.image_url || '' } : emptyBanner());
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.title?.trim()) return;
    onSave({
      kicker: form.kicker?.trim() || '',
      title: form.title.trim(),
      subtitle: form.subtitle?.trim() || '',
      cta_label: form.cta_label?.trim() || 'Shop now',
      link_to: form.link_to?.trim() || '/shop',
      image_url: form.image_url?.trim() || '',
      theme: form.theme,
      is_active: !!form.is_active,
      sort_order: Number(form.sort_order) || 0,
    });
  };

  return (
    <Modal open onClose={loading ? undefined : onClose} title={banner?.id ? 'Edit hero slide' : 'New hero slide'} maxWidth="max-w-lg">
      <form onSubmit={submit} className="space-y-4">
        {canManage && <HeroImageUploadField value={form.image_url} onChange={(v) => set('image_url', v)} />}
        <label className="block text-sm">
          <span className="mb-1 block font-bold">Kicker</span>
          <input className="input-field w-full" value={form.kicker} onChange={(e) => set('kicker', e.target.value)} placeholder="Official supplies" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-bold">Title</span>
          <input className="input-field w-full" value={form.title} onChange={(e) => set('title', e.target.value)} required />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-bold">Subtitle</span>
          <textarea className="input-field w-full min-h-[72px]" value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-bold">Button label</span>
            <input className="input-field w-full" value={form.cta_label} onChange={(e) => set('cta_label', e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-bold">Link (path)</span>
            <input className="input-field w-full" value={form.link_to} onChange={(e) => set('link_to', e.target.value)} placeholder="/shop" />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-bold">Colour theme</span>
            <select className="admin-filter-select w-full" value={form.theme} onChange={(e) => set('theme', e.target.value)}>
              {THEMES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-bold">Sort order</span>
            <input type="number" className="input-field w-full" value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} />
          </label>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={!!form.is_active} onChange={(e) => set('is_active', e.target.checked)} className="h-4 w-4 accent-brand-green" />
          Active (show on homepage)
        </label>
        <div className="flex justify-end gap-3 border-t border-black/10 pt-4 dark:border-white/10">
          <button type="button" onClick={onClose} disabled={loading} className="btn-ghost">Cancel</button>
          {canManage && (
            <button type="submit" disabled={loading || !form.title?.trim()} className="btn-primary">
              {loading ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

export default function AdminHeroBannersPage() {
  const user = useAuthStore((s) => s.user);
  const canView = hasAnyPermission(user, ['view_hero_banners', 'manage_hero_banners']);
  const canManage = hasPermission(user, 'manage_hero_banners');
  const { data: banners = [], isLoading } = useAdminHeroBanners(!!user && canView);

  if (user && !canView) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  const createBanner = useCreateHeroBanner();
  const updateBanner = useUpdateHeroBanner();
  const deleteBanner = useDeleteHeroBanner();

  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pageError, setPageError] = useState('');

  const activeCount = useMemo(() => banners.filter((b) => b.is_active).length, [banners]);

  const toggleActive = async (row) => {
    if (!canManage) return;
    setPageError('');
    try {
      await updateBanner.mutateAsync({ id: row.id, ...row, is_active: !row.is_active });
    } catch {
      setPageError('Could not update slide.');
    }
  };

  const saveBanner = async (payload) => {
    if (!canManage) return;
    setPageError('');
    try {
      if (modal?.id) {
        await updateBanner.mutateAsync({ id: modal.id, ...payload });
      } else {
        await createBanner.mutateAsync(payload);
      }
      setModal(null);
    } catch (err) {
      setPageError(err.response?.data?.message || 'Could not save slide.');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !canManage) return;
    setPageError('');
    try {
      await deleteBanner.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      setPageError('Could not delete slide.');
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <AdminPageHeader
        title="Hero banners"
        subtitle={`Homepage carousel slides — ${activeCount} active of ${banners.length}. Upload an image for each slide.`}
        actions={
          canManage ? (
            <button type="button" onClick={() => setModal({})} className="btn-primary px-4 py-2 text-sm">
              + Add slide
            </button>
          ) : null
        }
      />

      <AdminPageAlert message={pageError} onDismiss={() => setPageError('')} />

      {isLoading ? (
        <AdminTableSkeleton rows={4} cols={6} />
      ) : (
        <AdminTable
          columns={[
            { key: 'active', label: 'Active' },
            { key: 'title', label: 'Title' },
            { key: 'image', label: 'Image' },
            { key: 'order', label: 'Order' },
            { key: 'link', label: 'Link' },
            { key: 'actions', label: '', className: 'text-right' },
          ]}
        >
          {banners.map((b) => {
            const thumb = resolveImageUrl(b.image_url);
            return (
              <AdminTableRow key={b.id}>
                <AdminTableCell>
                  <input
                    type="checkbox"
                    checked={!!b.is_active}
                    disabled={!canManage || updateBanner.isPending}
                    onChange={() => toggleActive(b)}
                    className="h-4 w-4 accent-brand-green"
                    aria-label={`Active: ${b.title}`}
                  />
                </AdminTableCell>
                <AdminTableCell className="font-bold">{b.title}</AdminTableCell>
                <AdminTableCell>
                  {thumb ? (
                    <img src={thumb} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  ) : (
                    <span className="text-xs text-muted">No image</span>
                  )}
                </AdminTableCell>
                <AdminTableCell className="text-muted">{b.sort_order}</AdminTableCell>
                <AdminTableCell className="max-w-[140px] truncate text-xs text-muted">{b.link_to}</AdminTableCell>
                <AdminTableCell>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setModal(b)} className="text-xs font-bold text-brand-green">
                      {canManage ? 'Edit' : 'View'}
                    </button>
                    {canManage && (
                      <button type="button" onClick={() => setDeleteTarget(b)} className="text-xs font-bold text-brand-red">
                        Delete
                      </button>
                    )}
                  </div>
                </AdminTableCell>
              </AdminTableRow>
            );
          })}
        </AdminTable>
      )}

      {modal && (
        <BannerModal
          key={modal.id || 'new'}
          banner={modal.id ? modal : null}
          onClose={() => setModal(null)}
          onSave={saveBanner}
          loading={createBanner.isPending || updateBanner.isPending}
          canManage={canManage}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete hero slide?"
        message={deleteTarget ? `Remove "${deleteTarget.title}" from the homepage carousel?` : ''}
        confirmLabel="Delete"
        loading={deleteBanner.isPending}
      />
    </div>
  );
}
