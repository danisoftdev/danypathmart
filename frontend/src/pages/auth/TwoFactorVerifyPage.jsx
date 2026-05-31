import { useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import OTPInput from '../../components/auth/OTPInput';
import { useAuthStore } from '../../store/authStore';

export default function TwoFactorVerifyPage() {
  const navigate = useNavigate();
  const tempToken = useAuthStore((s) => s.tempToken);
  const setSession = useAuthStore((s) => s.setSession);

  const [useBackup, setUseBackup] = useState(false);
  const [backupCode, setBackupCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  if (!tempToken) {
    return <Navigate to="/login" replace />;
  }

  const finish = (data) => {
    setSession(data);
    navigate('/dashboard');
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
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
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
