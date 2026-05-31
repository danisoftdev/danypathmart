import { useState } from 'react';
import { useAuthStore } from '../../../store/authStore';
import { useWebAuthn } from '../../../hooks/useWebAuthn';
import {
  useChangePassword,
  useSessions,
  useRevokeSession,
  useCredentials,
  useRemoveCredential,
  useDisable2FA,
} from '../../../hooks/account';
import { meetsPolicy } from '../../../lib/password';
import PasswordStrength from '../../auth/PasswordStrength';
import TwoFactorSetup from '../../auth/TwoFactorSetup';
import OTPInput from '../../auth/OTPInput';
import Modal from '../Modal';

function Section({ title, description, children }) {
  return (
    <div className="card-panel">
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && <p className="mt-0.5 text-xs text-black/50 dark:text-white/50">{description}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function formatStamp(value) {
  if (!value) return '';
  const d = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function SecurityTab() {
  const user = useAuthStore((s) => s.user);
  const refreshMe = useAuthStore((s) => s.loadMe);

  return (
    <div className="space-y-5">
      <ChangePassword />
      <TwoFactor enabled={!!user?.totp_enabled} onChanged={refreshMe} />
      <Biometrics />
      <ActiveSessions />
    </div>
  );
}

function ChangePassword() {
  const changePassword = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    if (!current) return setErr('Enter your current password.');
    if (!meetsPolicy(next)) return setErr('New password needs 8+ characters, an uppercase letter and a number.');
    if (next !== confirm) return setErr('New passwords do not match.');
    try {
      await changePassword.mutateAsync({
        current_password: current,
        new_password: next,
        confirm_password: confirm,
      });
      setMsg('Password changed. Other devices have been signed out.');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (e2) {
      setErr(e2.response?.data?.message || 'Could not change your password.');
    }
  };

  return (
    <Section title="Change password" description="Use a strong, unique password.">
      <form onSubmit={submit} className="max-w-md space-y-3">
        <input
          type="password"
          className="modal-input"
          placeholder="Current password"
          value={current}
          autoComplete="current-password"
          onChange={(e) => setCurrent(e.target.value)}
        />
        <div>
          <input
            type="password"
            className="modal-input"
            placeholder="New password"
            value={next}
            autoComplete="new-password"
            onChange={(e) => setNext(e.target.value)}
          />
          <PasswordStrength password={next} />
        </div>
        <input
          type="password"
          className="modal-input"
          placeholder="Confirm new password"
          value={confirm}
          autoComplete="new-password"
          onChange={(e) => setConfirm(e.target.value)}
        />
        {err && <p className="text-sm text-brand-red">{err}</p>}
        {msg && <p className="text-sm text-brand-green">{msg}</p>}
        <button type="submit" className="btn-primary" disabled={changePassword.isPending}>
          {changePassword.isPending ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </Section>
  );
}

function TwoFactor({ enabled, onChanged }) {
  const disable2FA = useDisable2FA();
  const [setupOpen, setSetupOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [err, setErr] = useState('');

  const onDisable = async (code) => {
    setErr('');
    try {
      await disable2FA.mutateAsync(code);
      setDisableOpen(false);
      onChanged?.();
    } catch (e) {
      setErr(e.response?.data?.message || 'Incorrect code. Try again.');
    }
  };

  return (
    <Section title="Two-factor authentication" description="Protect your account with an authenticator app.">
      {enabled ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-brand-green/15 px-3 py-1 text-xs font-bold text-brand-green">ACTIVE</span>
          <button type="button" onClick={() => setDisableOpen(true)} className="btn-ghost py-2 text-sm">
            Disable 2FA
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setSetupOpen(true)} className="btn-primary text-sm">
          Enable Authenticator App
        </button>
      )}

      <Modal open={setupOpen} onClose={() => setSetupOpen(false)} title="Set up 2FA">
        <TwoFactorSetup
          onComplete={() => {
            setSetupOpen(false);
            onChanged?.();
          }}
        />
      </Modal>

      <Modal open={disableOpen} onClose={() => setDisableOpen(false)} title="Disable two-factor">
        <p className="mb-4 text-sm text-black/60 dark:text-white/60">
          Enter your current 6-digit authenticator code to turn off 2FA.
        </p>
        <OTPInput onComplete={onDisable} disabled={disable2FA.isPending} />
        {err && <p className="mt-3 text-center text-sm text-brand-red">{err}</p>}
      </Modal>
    </Section>
  );
}

function Biometrics() {
  const { registerBiometric, isSupported } = useWebAuthn();
  const { data: creds, isLoading } = useCredentials();
  const removeCred = useRemoveCredential();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setErr('');
    setBusy(true);
    try {
      await registerBiometric('My device');
    } catch (e) {
      if (e?.name === 'NotAllowedError') setErr('Setup was cancelled.');
      else setErr(e.response?.data?.message || 'Could not add a passkey.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Biometric login" description="Sign in with Face ID, fingerprint, or a security key.">
      {!isSupported && (
        <p className="text-sm text-black/50 dark:text-white/50">
          This browser does not support passkeys.
        </p>
      )}

      {isSupported && (
        <>
          {isLoading ? (
            <p className="text-sm text-black/50 dark:text-white/50">Loading...</p>
          ) : (creds || []).length === 0 ? (
            <p className="text-sm text-black/50 dark:text-white/50">No passkeys registered yet.</p>
          ) : (
            <ul className="divide-y divide-black/5 dark:divide-white/10">
              {creds.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-green/10 text-brand-green">
                      <KeyIcon />
                    </span>
                    <div>
                      <p className="text-sm font-medium">{c.device_name}</p>
                      <p className="text-xs text-black/50 dark:text-white/50">Added {formatStamp(c.created_at)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCred.mutate(c.id)}
                    className="text-xs font-semibold text-brand-red hover:underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          {err && <p className="mt-3 text-sm text-brand-red">{err}</p>}
          <button type="button" onClick={add} disabled={busy} className="btn-ghost mt-4 py-2 text-sm">
            {busy ? 'Waiting for device...' : 'Add Face ID / Fingerprint / Passkey'}
          </button>
        </>
      )}
    </Section>
  );
}

function ActiveSessions() {
  const { data: sessions, isLoading } = useSessions();
  const revoke = useRevokeSession();

  return (
    <Section title="Active sessions" description="Devices currently signed in to your account.">
      {isLoading ? (
        <p className="text-sm text-black/50 dark:text-white/50">Loading...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase text-black/40 dark:text-white/40">
                <th className="py-2 pr-4 font-medium">Device</th>
                <th className="py-2 pr-4 font-medium">Browser</th>
                <th className="py-2 pr-4 font-medium">IP</th>
                <th className="py-2 pr-4 font-medium">Last active</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {(sessions || []).map((s) => (
                <tr key={s.id}>
                  <td className="py-3 pr-4">
                    {s.device}
                    {s.is_current && (
                      <span className="ml-2 rounded-full bg-brand-green/15 px-2 py-0.5 text-[10px] font-semibold text-brand-green">
                        This device
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-black/60 dark:text-white/60">{s.browser}</td>
                  <td className="py-3 pr-4 text-black/60 dark:text-white/60">{s.ip_address}</td>
                  <td className="py-3 pr-4 text-black/60 dark:text-white/60">{formatStamp(s.last_used)}</td>
                  <td className="py-3 text-right">
                    {!s.is_current && (
                      <button
                        type="button"
                        onClick={() => revoke.mutate(s.id)}
                        className="text-xs font-semibold text-brand-red hover:underline"
                      >
                        Log out
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="15" r="4" />
      <path d="M10.8 12.2L20 3M17 6l2 2M14 9l2 2" />
    </svg>
  );
}
