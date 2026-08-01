import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import { useDeleteAccount, useUpdateProfile, useUploadAvatar } from '../../../hooks/account';
import { canChangeProfilePhoto } from '../../../lib/brand';
import UserAvatar from '../../brand/UserAvatar';
import { CameraIcon } from '../../icons';
import ChangeEmailModal from './ChangeEmailModal';
import api from '../../../lib/api';

const FALLBACK_REASONS = {
  not_using: 'I no longer use DanyPathMart',
  privacy: 'Privacy concerns',
  too_many_emails: 'Too many emails / notifications',
  duplicate: 'I have another account',
  other: 'Other',
};

export default function ProfileTab() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const deleteAccount = useDeleteAccount();
  const fileRef = useRef(null);
  const allowPhotoChange = canChangeProfilePhoto(user);

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [emailModal, setEmailModal] = useState(false);

  const [reasons, setReasons] = useState(FALLBACK_REASONS);
  const [retentionDays, setRetentionDays] = useState(14);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteDetail, setDeleteDetail] = useState('');
  const [deleteErr, setDeleteErr] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/users/account/deletion');
        if (cancelled) return;
        if (data.reasons) setReasons(data.reasons);
        if (data.retention_days) setRetentionDays(data.retention_days);
      } catch {
        /* keep fallbacks */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onPickAvatar = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !allowPhotoChange) return;
    setErr('');
    setMsg('');
    try {
      await uploadAvatar.mutateAsync(file);
      setMsg('Photo updated.');
    } catch (e2) {
      setErr(e2.response?.data?.message || 'Could not upload the photo.');
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    if (!name.trim()) return setErr('Your name is required.');
    if (name.trim().length < 2) return setErr('Name is too short.');
    try {
      await updateProfile.mutateAsync({ name: name.trim(), phone: phone.trim() });
      setMsg('Profile saved.');
    } catch (e2) {
      setErr(e2.response?.data?.message || 'Could not save your profile.');
    }
  };

  const onDelete = async (e) => {
    e.preventDefault();
    setDeleteErr('');
    if (!deleteReason) {
      setDeleteErr('Please select a reason.');
      return;
    }
    if (deleteReason === 'other' && !deleteDetail.trim()) {
      setDeleteErr('Please write a short reason.');
      return;
    }
    if (deleteConfirm.trim().toUpperCase() !== 'DELETE') {
      setDeleteErr('Type DELETE to confirm.');
      return;
    }
    try {
      await deleteAccount.mutateAsync({ reason: deleteReason, detail: deleteDetail.trim() || undefined });
      await logout();
      navigate('/login', {
        state: {
          message: `Account scheduled for deletion. Sign in within ${retentionDays} days to restore it.`,
        },
      });
    } catch (e2) {
      setDeleteErr(e2.response?.data?.message || 'Could not schedule deletion.');
    }
  };

  const isStaff = user?.role === 'super_admin' || user?.role === 'staff';

  return (
    <>
      <form onSubmit={save} className="card-panel max-w-xl space-y-5">
        <div className="flex items-center gap-4">
          {allowPhotoChange ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="group relative"
              aria-label="Upload profile photo"
            >
              <UserAvatar user={user} className="h-20 w-20" imgClassName="object-cover" />
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition group-hover:opacity-100">
                <CameraIcon className="h-5 w-5" />
              </span>
            </button>
          ) : (
            <UserAvatar user={user} className="h-20 w-20" />
          )}
          <div>
            <p className="text-sm font-semibold">{user?.name}</p>
            {allowPhotoChange ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-1 text-xs font-semibold text-brand-green hover:underline"
              >
                {uploadAvatar.isPending ? 'Uploading...' : 'Change photo'}
              </button>
            ) : (
              <p className="mt-1 text-xs text-muted">Official DanyPathMart profile</p>
            )}
          </div>
          {allowPhotoChange && (
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickAvatar} />
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Full name</label>
          <input className="modal-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Email</label>
          <div className="flex items-center gap-2">
            <input className="modal-input cursor-not-allowed opacity-70" value={user?.email || ''} readOnly />
            <button
              type="button"
              onClick={() => setEmailModal(true)}
              className="btn-ghost shrink-0 px-3 py-2 text-xs"
            >
              Change
            </button>
          </div>
          <p className="mt-1 text-xs text-black/50 dark:text-white/50">
            Changing your email requires verifying the new address.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Phone</label>
          <input
            className="modal-input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+233..."
          />
        </div>

        {err && <p className="text-sm text-brand-red">{err}</p>}
        {msg && <p className="text-sm text-brand-green">{msg}</p>}

        <button type="submit" className="btn-primary" disabled={updateProfile.isPending}>
          {updateProfile.isPending ? 'Saving...' : 'Save changes'}
        </button>
      </form>

      {!isStaff && (
        <div className="card-panel mt-8 max-w-xl space-y-4 border border-brand-red/20">
          <h2 className="text-base font-extrabold text-brand-red">Delete account</h2>
          <p className="text-sm text-muted">
            Your account stays recoverable for {retentionDays} days. If you sign in again during that window,
            it is restored automatically. After {retentionDays} days it is permanently removed.
          </p>
          {!deleteOpen ? (
            <button type="button" className="btn-ghost text-sm text-brand-red" onClick={() => setDeleteOpen(true)}>
              I want to delete my account
            </button>
          ) : (
            <form onSubmit={onDelete} className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Reason</label>
                <select
                  className="modal-input"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  required
                >
                  <option value="">Select a reason…</option>
                  {Object.entries(reasons).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              {(deleteReason === 'other' || deleteReason) && (
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    {deleteReason === 'other' ? 'Write your reason *' : 'More detail (optional)'}
                  </label>
                  <textarea
                    className="modal-input min-h-[80px]"
                    value={deleteDetail}
                    onChange={(e) => setDeleteDetail(e.target.value)}
                    maxLength={500}
                    placeholder="Tell us more…"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium">Type DELETE to confirm</label>
                <input
                  className="modal-input"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="DELETE"
                  autoComplete="off"
                />
              </div>
              {deleteErr && <p className="text-sm text-brand-red">{deleteErr}</p>}
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="rounded-xl bg-brand-red px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                  disabled={deleteAccount.isPending}
                >
                  {deleteAccount.isPending ? 'Scheduling…' : 'Delete my account'}
                </button>
                <button
                  type="button"
                  className="btn-ghost text-sm"
                  onClick={() => {
                    setDeleteOpen(false);
                    setDeleteErr('');
                    setDeleteConfirm('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <ChangeEmailModal
        open={emailModal}
        onClose={() => setEmailModal(false)}
        currentEmail={user?.email}
        onChanged={() => setMsg('Email address updated.')}
      />
    </>
  );
}
