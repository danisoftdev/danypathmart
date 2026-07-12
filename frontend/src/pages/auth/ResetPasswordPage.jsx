import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import OTPInput from '../../components/auth/OTPInput';
import PasswordStrength from '../../components/auth/PasswordStrength';
import { meetsPolicy } from '../../lib/password';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [identifier, setIdentifier] = useState(() => location.state?.identifier || '');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const usingLink = token.length > 0;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!meetsPolicy(password)) {
      return setError('Password needs 8+ characters, an uppercase letter, and a number.');
    }
    if (password !== confirm) return setError('Passwords do not match.');
    if (!usingLink) {
      if (!identifier.trim()) return setError('Enter the email or username you used to request a reset.');
      if (!/^\d{6}$/.test(otp)) return setError('Enter the 6-digit code from your email.');
    }

    setLoading(true);
    try {
      const payload = {
        new_password: password,
        confirm_password: confirm,
      };
      if (usingLink) {
        payload.token = token;
      } else {
        payload.identifier = identifier.trim();
        payload.otp = otp;
      }
      await api.post('/auth/reset-password', payload);
      navigate('/login', { state: { reset: true } });
    } catch (err) {
      setError(err.response?.data?.message || 'This reset link or code is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="auth-card">
      <h1 className="mb-2 text-2xl font-bold">Set a new password</h1>
      <p className="mb-6 text-sm text-muted">
        {usingLink
          ? 'Choose a new password to finish resetting your account.'
          : 'Enter the 6-digit code from your email, then choose a new password.'}
      </p>
      {error && (
        <div className="mb-4 rounded-lg bg-brand-red/10 px-3 py-2 text-sm text-brand-red">{error}</div>
      )}

      {!usingLink && (
        <>
          <label className="mb-4 block">
            <span className="mb-1 block text-sm font-medium">Email or username</span>
            <input
              className="input-field"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <div className="mb-5">
            <span className="mb-2 block text-sm font-medium">6-digit code</span>
            <OTPInput length={6} onComplete={setOtp} disabled={loading} />
          </div>
        </>
      )}

      <label className="mb-1 block">
        <span className="mb-1 block text-sm font-medium">New password</span>
        <input
          type="password"
          className="input-field"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
      </label>
      <PasswordStrength password={password} />
      <label className="mb-5 mt-3 block">
        <span className="mb-1 block text-sm font-medium">Confirm new password</span>
        <input
          type="password"
          className="input-field"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />
      </label>
      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? 'Saving...' : 'Reset password'}
      </button>
      <p className="mt-4 text-center text-sm text-muted">
        <Link to="/forgot-password" className="font-semibold text-brand-green">Request a new code</Link>
        {' · '}
        <Link to="/login" className="font-semibold text-brand-green">Back to login</Link>
      </p>
    </form>
  );
}
