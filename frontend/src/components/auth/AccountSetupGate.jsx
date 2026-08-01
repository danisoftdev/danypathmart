import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import OTPInput from './OTPInput';

/**
 * Forced first-login setup: new password + email OTP when the account
 * was created from a promoter application (temp password).
 */
export default function AccountSetupGate() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  // Temp-password accounts (promoter applications) must finish setup before using the app.
  const needsSetup = !!(
    user?.must_change_password
    || (user?.needs_email_verification && user?.role === 'promoter')
  );

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!needsSetup) return undefined;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [needsSetup]);

  useEffect(() => {
    if (countdown <= 0) return undefined;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  if (!needsSetup || !user) return null;

  const needsOtp = !!user.needs_email_verification;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/set-password', {
        password,
        confirm_password: confirm,
        otp_code: otp,
      });
      setUser(data.user);
      setPassword('');
      setConfirm('');
      setOtp('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not finish setup. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    if (!user?.id || countdown > 0) return;
    setError('');
    setInfo('');
    try {
      await api.post('/auth/resend-otp', { user_id: user.id, type: 'registration' });
      setInfo('A new code was sent to your email.');
      setCountdown(60);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resend the code.');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" aria-hidden />
      <div
        className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-[#1c1c1c]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-setup-title"
      >
        <h2 id="account-setup-title" className="text-xl font-extrabold">
          Finish account setup
        </h2>
        <p className="mt-2 text-sm text-muted">
          Choose a new password
          {needsOtp ? ' and enter the verification code from your email' : ''}
          {' '}before continuing.
        </p>

        {error && (
          <p className="mt-3 rounded-xl border border-brand-red/30 bg-brand-red/10 px-3 py-2 text-sm text-brand-red">
            {error}
          </p>
        )}
        {info && (
          <p className="mt-3 rounded-xl border border-brand-green/30 bg-brand-green/10 px-3 py-2 text-sm text-brand-green">
            {info}
          </p>
        )}

        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">New password</span>
            <input
              type="password"
              className="input-field w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            <span className="mt-1 block text-xs text-muted">
              At least 8 characters, with an uppercase letter and a number.
            </span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Confirm password</span>
            <input
              type="password"
              className="input-field w-full"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          {needsOtp && (
            <div>
              <p className="mb-2 text-sm font-semibold">Email verification code</p>
              <OTPInput
                disabled={submitting}
                onComplete={(code) => setOtp(code)}
              />
              <button
                type="button"
                className="mt-2 text-sm font-semibold text-brand-green disabled:opacity-50"
                onClick={resend}
                disabled={countdown > 0}
              >
                {countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
              </button>
            </div>
          )}
          <button
            type="submit"
            className="btn-primary w-full min-h-[48px]"
            disabled={submitting || (needsOtp && otp.length < 6)}
          >
            {submitting ? 'Saving…' : 'Save and continue'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
