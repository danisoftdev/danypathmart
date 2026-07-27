import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { hasAnyPermission, hasPermission } from '../../lib/permissions';
import {
  useAdminAboutPage,
  useCreateAboutTeamMember,
  useDeleteAboutTeamMember,
  useUpdateAboutPage,
  useUpdateAboutTeamMember,
  useUploadAboutPhoto,
} from '../../hooks/storefront';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminPageAlert from '../../components/admin/AdminPageAlert';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import Modal from '../../components/dashboard/Modal';
import { AdminTableSkeleton } from '../../components/ui/Skeleton';
import { resolveImageUrl } from '../../lib/currency';

function ToggleField({ label, hint, checked, onChange, disabled }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border border-black/8 p-3 dark:border-white/10 ${disabled ? 'opacity-60' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-brand-green"
      />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="space-y-3 rounded-2xl border border-black/8 p-4 dark:border-white/10">
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-brand-green">{title}</h2>
      {children}
    </section>
  );
}

function ItemListEditor({ items, onChange, mode = 'title', disabled }) {
  const rows = Array.isArray(items) ? items : [];
  const setRow = (idx, key, value) => {
    const next = rows.map((row, i) => (i === idx ? { ...row, [key]: value } : row));
    onChange(next);
  };
  const add = () => {
    if (mode === 'label') onChange([...rows, { label: '', value: '' }]);
    else onChange([...rows, { title: '', body: '' }]);
  };
  const remove = (idx) => onChange(rows.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      {rows.map((row, idx) => (
        <div key={idx} className="grid gap-2 rounded-xl border border-black/8 p-3 dark:border-white/10 sm:grid-cols-[1fr_1.4fr_auto]">
          <input
            className="input-field"
            disabled={disabled}
            placeholder={mode === 'label' ? 'Label' : 'Title'}
            value={mode === 'label' ? (row.label || '') : (row.title || '')}
            onChange={(e) => setRow(idx, mode === 'label' ? 'label' : 'title', e.target.value)}
          />
          <textarea
            className="input-field min-h-[64px]"
            disabled={disabled}
            placeholder={mode === 'label' ? 'Value / note' : 'Body'}
            value={mode === 'label' ? (row.value || '') : (row.body || '')}
            onChange={(e) => setRow(idx, mode === 'label' ? 'value' : 'body', e.target.value)}
          />
          {canRemove(disabled) && (
            <button type="button" className="text-xs font-bold text-brand-red" onClick={() => remove(idx)}>
              Remove
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button type="button" className="text-sm font-bold text-brand-green" onClick={add}>
          + Add item
        </button>
      )}
    </div>
  );
}

function canRemove(disabled) {
  return !disabled;
}

function emptyMember() {
  return { name: '', role_title: '', bio: '', photo_url: '', linkedin_url: '', website_url: '', sort_order: 0, is_visible: true };
}

function TeamPhotoField({ value, onChange, disabled }) {
  const upload = useUploadAboutPhoto();
  const inputRef = useRef(null);
  const [error, setError] = useState('');
  const preview = resolveImageUrl(value);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try {
      const { url } = await upload.mutateAsync(file);
      onChange(url);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not upload photo.');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={disabled || upload.isPending}
          onClick={() => inputRef.current?.click()}
          className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-black/15 dark:border-white/25"
        >
          {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <span className="text-xs text-muted">+</span>}
        </button>
        <div className="min-w-0 flex-1">
          <input className="input-field" disabled={disabled} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="/uploads/about/…" />
          {value && !disabled && (
            <button type="button" className="mt-1 text-xs font-bold text-brand-red" onClick={() => onChange('')}>
              Remove photo
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-xs text-brand-red">{error}</p>}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} />
    </div>
  );
}

function TeamModal({ member, onClose, onSave, loading, canManage }) {
  const [form, setForm] = useState(member?.id ? { ...member } : emptyMember());
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal open onClose={loading ? undefined : onClose} title={member?.id ? 'Edit team member' : 'Add team member'} maxWidth="max-w-lg">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.name?.trim()) return;
          onSave({
            name: form.name.trim(),
            role_title: form.role_title?.trim() || '',
            bio: form.bio?.trim() || '',
            photo_url: form.photo_url?.trim() || '',
            linkedin_url: form.linkedin_url?.trim() || '',
            website_url: form.website_url?.trim() || '',
            sort_order: Number(form.sort_order) || 0,
            is_visible: !!form.is_visible,
          });
        }}
      >
        {canManage && <TeamPhotoField value={form.photo_url} onChange={(v) => set('photo_url', v)} disabled={!canManage} />}
        <Field label="Name">
          <input className="input-field w-full" required value={form.name} onChange={(e) => set('name', e.target.value)} disabled={!canManage} />
        </Field>
        <Field label="Role">
          <input className="input-field w-full" value={form.role_title} onChange={(e) => set('role_title', e.target.value)} disabled={!canManage} />
        </Field>
        <Field label="Short bio">
          <textarea className="input-field w-full min-h-[80px]" value={form.bio} onChange={(e) => set('bio', e.target.value)} disabled={!canManage} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="LinkedIn URL">
            <input className="input-field w-full" value={form.linkedin_url || ''} onChange={(e) => set('linkedin_url', e.target.value)} disabled={!canManage} placeholder="https://linkedin.com/in/…" />
          </Field>
          <Field label="Website URL">
            <input className="input-field w-full" value={form.website_url || ''} onChange={(e) => set('website_url', e.target.value)} disabled={!canManage} placeholder="https://…" />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Sort order">
            <input type="number" className="input-field w-full" value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} disabled={!canManage} />
          </Field>
          <label className="flex items-center gap-2 pt-6 text-sm font-semibold">
            <input type="checkbox" checked={!!form.is_visible} onChange={(e) => set('is_visible', e.target.checked)} disabled={!canManage} className="accent-brand-green" />
            Visible on About page
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          {canManage && (
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

export default function AdminAboutPage() {
  const user = useAuthStore((s) => s.user);
  const canView = hasAnyPermission(user, ['view_about_page', 'manage_about_page']);
  const canManage = hasPermission(user, 'manage_about_page');
  const { data, isLoading, isError, error } = useAdminAboutPage(canView);
  const updatePage = useUpdateAboutPage();
  const createMember = useCreateAboutTeamMember();
  const updateMember = useUpdateAboutTeamMember();
  const deleteMember = useDeleteAboutTeamMember();

  const [form, setForm] = useState(null);
  const [alert, setAlert] = useState(null);
  const [teamModal, setTeamModal] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    if (data) {
      const { team, ...rest } = data;
      setForm({ ...rest, team: team || [] });
    }
  }, [data]);

  if (!canView) return <Navigate to="/admin/dashboard" replace />;

  const set = (key, value) => setForm((f) => (f ? { ...f, [key]: value } : f));

  const savePage = async (e) => {
    e.preventDefault();
    if (!form || !canManage) return;
    setAlert(null);
    try {
      const { team, ...payload } = form;
      await updatePage.mutateAsync(payload);
      setAlert({ type: 'success', message: 'About page saved.' });
    } catch (err) {
      setAlert({ type: 'error', message: err.response?.data?.message || 'Could not save.' });
    }
  };

  const saveMember = async (payload) => {
    try {
      if (teamModal?.id) {
        await updateMember.mutateAsync({ id: teamModal.id, ...payload });
      } else {
        await createMember.mutateAsync(payload);
      }
      setTeamModal(null);
      setAlert({ type: 'success', message: 'Team member saved.' });
    } catch (err) {
      setAlert({ type: 'error', message: err.response?.data?.message || 'Could not save team member.' });
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMember.mutateAsync(deleteId);
      setDeleteId(null);
      setAlert({ type: 'success', message: 'Team member removed.' });
    } catch (err) {
      setAlert({ type: 'error', message: err.response?.data?.message || 'Could not delete.' });
    }
  };

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="About Us"
        subtitle="Public /about page content, toggles, and team."
        actions={
          form?.page_enabled ? (
            <Link to="/about" target="_blank" className="btn-secondary text-sm">
              View live page
            </Link>
          ) : null
        }
      />
      {alert && <AdminPageAlert type={alert.type} message={alert.message} onDismiss={() => setAlert(null)} />}
      {isLoading || !form ? (
        <AdminTableSkeleton rows={6} />
      ) : isError ? (
        <AdminPageAlert type="error" message={error?.response?.data?.message || 'Failed to load About page.'} />
      ) : (
        <form onSubmit={savePage} className="space-y-4">
          <Section title="Visibility">
            <ToggleField
              label="Show About Us page"
              hint="When off, /about is hidden and footer/header links are removed."
              checked={!!form.page_enabled}
              onChange={(v) => set('page_enabled', v)}
              disabled={!canManage}
            />
            <ToggleField
              label="Show “Trusted by” section"
              hint="Optional social-proof strip. Off by default — turn on only when you have real labels to show."
              checked={!!form.trusted_by_enabled}
              onChange={(v) => set('trusted_by_enabled', v)}
              disabled={!canManage}
            />
            {form.trusted_by_enabled && (
              <>
                <Field label="Trusted by heading">
                  <input className="input-field w-full" value={form.trusted_by_heading || ''} onChange={(e) => set('trusted_by_heading', e.target.value)} disabled={!canManage} />
                </Field>
                <ItemListEditor items={form.trusted_by_items} onChange={(v) => set('trusted_by_items', v)} mode="label" disabled={!canManage} />
              </>
            )}
          </Section>

          <Section title="Hero">
            <Field label="Kicker"><input className="input-field w-full" value={form.hero_kicker || ''} onChange={(e) => set('hero_kicker', e.target.value)} disabled={!canManage} /></Field>
            <Field label="Title"><input className="input-field w-full" required value={form.hero_title || ''} onChange={(e) => set('hero_title', e.target.value)} disabled={!canManage} /></Field>
            <Field label="Subtitle"><textarea className="input-field w-full min-h-[72px]" value={form.hero_subtitle || ''} onChange={(e) => set('hero_subtitle', e.target.value)} disabled={!canManage} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Primary CTA label"><input className="input-field w-full" value={form.hero_cta_label || ''} onChange={(e) => set('hero_cta_label', e.target.value)} disabled={!canManage} /></Field>
              <Field label="Primary CTA link"><input className="input-field w-full" value={form.hero_cta_link || ''} onChange={(e) => set('hero_cta_link', e.target.value)} disabled={!canManage} /></Field>
              <Field label="Secondary CTA label"><input className="input-field w-full" value={form.hero_secondary_label || ''} onChange={(e) => set('hero_secondary_label', e.target.value)} disabled={!canManage} /></Field>
              <Field label="Secondary CTA link"><input className="input-field w-full" value={form.hero_secondary_link || ''} onChange={(e) => set('hero_secondary_link', e.target.value)} disabled={!canManage} /></Field>
            </div>
          </Section>

          <Section title="Our story">
            <Field label="Heading"><input className="input-field w-full" value={form.story_heading || ''} onChange={(e) => set('story_heading', e.target.value)} disabled={!canManage} /></Field>
            <Field label="Body"><textarea className="input-field w-full min-h-[140px]" value={form.story_body || ''} onChange={(e) => set('story_body', e.target.value)} disabled={!canManage} /></Field>
          </Section>

          <Section title="What we do">
            <Field label="Heading"><input className="input-field w-full" value={form.what_we_do_heading || ''} onChange={(e) => set('what_we_do_heading', e.target.value)} disabled={!canManage} /></Field>
            <Field label="Intro"><textarea className="input-field w-full min-h-[64px]" value={form.what_we_do_intro || ''} onChange={(e) => set('what_we_do_intro', e.target.value)} disabled={!canManage} /></Field>
            <ItemListEditor items={form.what_we_do_items} onChange={(v) => set('what_we_do_items', v)} disabled={!canManage} />
          </Section>

          <Section title="Who we serve">
            <Field label="Heading"><input className="input-field w-full" value={form.who_we_serve_heading || ''} onChange={(e) => set('who_we_serve_heading', e.target.value)} disabled={!canManage} /></Field>
            <Field label="Intro"><textarea className="input-field w-full min-h-[64px]" value={form.who_we_serve_intro || ''} onChange={(e) => set('who_we_serve_intro', e.target.value)} disabled={!canManage} /></Field>
            <ItemListEditor items={form.who_we_serve_items} onChange={(v) => set('who_we_serve_items', v)} disabled={!canManage} />
          </Section>

          <Section title="Our team">
            <Field label="Heading"><input className="input-field w-full" value={form.team_heading || ''} onChange={(e) => set('team_heading', e.target.value)} disabled={!canManage} /></Field>
            <Field label="Intro"><textarea className="input-field w-full min-h-[64px]" value={form.team_intro || ''} onChange={(e) => set('team_intro', e.target.value)} disabled={!canManage} /></Field>
            <div className="space-y-2">
              {(form.team || []).map((m) => (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/8 p-3 dark:border-white/10">
                  <div className="flex items-center gap-3">
                    {m.photo_url ? (
                      <img src={resolveImageUrl(m.photo_url)} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-green/10 text-xs font-bold text-brand-green">
                        {(m.name || '?').slice(0, 1)}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-bold">{m.name}</p>
                      <p className="text-xs text-muted">{m.role_title || '—'} · {m.is_visible ? 'Visible' : 'Hidden'}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="text-xs font-bold text-brand-green" onClick={() => setTeamModal(m)}>Edit</button>
                    {canManage && (
                      <button type="button" className="text-xs font-bold text-brand-red" onClick={() => setDeleteId(m.id)}>Delete</button>
                    )}
                  </div>
                </div>
              ))}
              {canManage && (
                <button type="button" className="text-sm font-bold text-brand-green" onClick={() => setTeamModal(emptyMember())}>
                  + Add team member
                </button>
              )}
            </div>
          </Section>

          <Section title="Part of DSD Groups">
            <Field label="Heading"><input className="input-field w-full" value={form.dsd_heading || ''} onChange={(e) => set('dsd_heading', e.target.value)} disabled={!canManage} /></Field>
            <Field label="Intro"><textarea className="input-field w-full min-h-[72px]" value={form.dsd_intro || ''} onChange={(e) => set('dsd_intro', e.target.value)} disabled={!canManage} /></Field>
            <Field label="Vision"><textarea className="input-field w-full min-h-[72px]" value={form.dsd_vision || ''} onChange={(e) => set('dsd_vision', e.target.value)} disabled={!canManage} /></Field>
            <Field label="Mission"><textarea className="input-field w-full min-h-[72px]" value={form.dsd_mission || ''} onChange={(e) => set('dsd_mission', e.target.value)} disabled={!canManage} /></Field>
            <p className="text-xs font-semibold text-muted">Core values</p>
            <ItemListEditor items={form.dsd_values} onChange={(v) => set('dsd_values', v)} disabled={!canManage} />
          </Section>

          <Section title="Bottom CTA">
            <Field label="Heading"><input className="input-field w-full" value={form.cta_heading || ''} onChange={(e) => set('cta_heading', e.target.value)} disabled={!canManage} /></Field>
            <Field label="Body"><textarea className="input-field w-full min-h-[64px]" value={form.cta_body || ''} onChange={(e) => set('cta_body', e.target.value)} disabled={!canManage} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Primary label"><input className="input-field w-full" value={form.cta_primary_label || ''} onChange={(e) => set('cta_primary_label', e.target.value)} disabled={!canManage} /></Field>
              <Field label="Primary link"><input className="input-field w-full" value={form.cta_primary_link || ''} onChange={(e) => set('cta_primary_link', e.target.value)} disabled={!canManage} /></Field>
              <Field label="Secondary label"><input className="input-field w-full" value={form.cta_secondary_label || ''} onChange={(e) => set('cta_secondary_label', e.target.value)} disabled={!canManage} /></Field>
              <Field label="Secondary link"><input className="input-field w-full" value={form.cta_secondary_link || ''} onChange={(e) => set('cta_secondary_link', e.target.value)} disabled={!canManage} /></Field>
            </div>
          </Section>

          <Section title="SEO">
            <Field label="Page title"><input className="input-field w-full" value={form.seo_title || ''} onChange={(e) => set('seo_title', e.target.value)} disabled={!canManage} /></Field>
            <Field label="Meta description"><textarea className="input-field w-full min-h-[64px]" value={form.seo_description || ''} onChange={(e) => set('seo_description', e.target.value)} disabled={!canManage} /></Field>
          </Section>

          {canManage && (
            <div className="sticky bottom-4 z-10 flex justify-end">
              <button type="submit" className="btn-primary shadow-lg" disabled={updatePage.isPending}>
                {updatePage.isPending ? 'Saving…' : 'Save About page'}
              </button>
            </div>
          )}
        </form>
      )}

      {teamModal && (
        <TeamModal
          member={teamModal}
          onClose={() => setTeamModal(null)}
          onSave={saveMember}
          loading={createMember.isPending || updateMember.isPending}
          canManage={canManage}
        />
      )}
      <ConfirmDialog
        open={!!deleteId}
        title="Remove team member?"
        message="They will no longer appear on the About page."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onClose={() => setDeleteId(null)}
        loading={deleteMember.isPending}
      />    </div>
  );
}
