import { useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import OTPInput from '../../components/auth/OTPInput';
import { useAuthStore } from '../../store/authStore';
import { homePathForUser } from '../../lib/permissions';

export default function TwoFactorVerifyPage() {
  const navigate = useNavigate();
  const tempToken = useAuthStore((s) => s.tempToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);

  const [useBackup, setUseBackup] = useState(false);
  const [backupCode, setBackupCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  // After a successful verify, setSession clears tempToken before navigate
  // finishes — send authenticated users to their home route, not back to login.
  if (isAuthenticated && user) {
    return <Navigate to={homePathForUser(user)} replace />;
  }

  if (!tempToken) {
    return <Navigate to="/login" replace />;
  }

  const finish = (data) => {
    if (!data?.access_token || !data?.user) {
      setError('Login response was incomplete. Please try again.');
      submittedRef.current = false;
      return;
    }
    setSession(data);
    navigate(homePathForUser(data.user), { replace: true });
  };

  const verifyTotp = async (code) => {
    if (submitting || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setError('');
    try {
      const { data } = await api.post('/auth/2fa/verify', { temp_token: tempToken, totp_code: code });
      finish(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Incorrect code. Try again.');
      submittedRef.current = false;
    } finally {
      setSubmitting(false);
    }
  };

  const verifyBackup = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const { data } = await api.post('/auth/2fa/backup', {
        temp_token: tempToken,
        backup_code: backupCode.trim(),
      });
      finish(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid backup code.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-card text-center">
      <h1 className="mb-1 text-2xl font-bold">Two-factor authentication</h1>
      <p className="mb-6 text-sm text-muted">
        {useBackup ? 'Enter one of your backup codes.' : 'Enter the 6-digit code from your authenticator app.'}
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-brand-red/10 px-3 py-2 text-sm text-brand-red">{error}</div>
      )}

      {useBackup ? (
        <form onSubmit={verifyBackup}>
          <input
            className="input-field text-center font-mono tracking-widest"
            value={backupCode}
            onChange={(e) => setBackupCode(e.target.value)}
            placeholder="XXXX-XXXX"
          />
          <button type="submit" className="btn-primary mt-4 w-full" disabled={submitting}>
            {submitting ? 'Verifying...' : 'Verify'}
          </button>
        </form>
      ) : (
        <OTPInput onComplete={verifyTotp} disabled={submitting} />
      )}

      <button
        type="button"
        onClick={() => {
          setUseBackup((v) => !v);
          setError('');
        }}
        className="mt-6 text-sm font-medium text-brand-green"
      >
        {useBackup ? 'Use authenticator code instead' : 'Use a backup code'}
      </button>
    </div>
  );
}
