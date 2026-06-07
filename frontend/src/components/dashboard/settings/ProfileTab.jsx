import { useRef, useState } from 'react';
import { useAuthStore } from '../../../store/authStore';
import { useUpdateProfile, useUploadAvatar } from '../../../hooks/account';
import { canChangeProfilePhoto } from '../../../lib/brand';
import UserAvatar from '../../brand/UserAvatar';
import { CameraIcon } from '../../icons';
import ChangeEmailModal from './ChangeEmailModal';

export default function ProfileTab() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const fileRef = useRef(null);
  const allowPhotoChange = canChangeProfilePhoto(user);

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [emailModal, setEmailModal] = useState(false);

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
    try {
      await updateProfile.mutateAsync({ name: name.trim(), phone: phone.trim() });
      setMsg('Profile saved.');
    } catch (e2) {
      setErr(e2.response?.data?.message || 'Could not save your profile.');
    }
  };

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

      <ChangeEmailModal
        open={emailModal}
        onClose={() => setEmailModal(false)}
        currentEmail={user?.email}
        onChanged={() => setMsg('Email address updated.')}
      />
    </>
  );
}
