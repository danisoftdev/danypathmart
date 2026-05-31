import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import PasswordStrength from '../../components/auth/PasswordStrength';
import { meetsPolicy } from '../../lib/password';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!meetsPolicy(password)) {
      return setError('Password needs 8+ characters, an uppercase letter, and a number.');
    }
    if (password !== confirm) return setError('Passwords do not match.');

    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        token,
        new_password: password,
        confirm_password: confirm,
      });
      navigate('/login', { state: { reset: true } });
    } catch (err) {
      setError(err.response?.data?.message || 'This reset link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-card text-center">
        <h1 className="mb-2 text-xl font-bold">Invalid reset link</h1>
        <Link to="/forgot-password" className="btn-primary mt-2 inline-block">Request a new link</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="auth-card">
      <h1 className="mb-6 text-2xl font-bold">Set a new password</h1>
      {error && (
        <div className="mb-4 rounded-lg bg-brand-red/10 px-3 py-2 text-sm text-brand-red">{error}</div>
      )}
      <label className="mb-1 block">
        <span className="mb-1 block text-sm font-medium">New password</span>
        <input
          type="password"
          className="input-field"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
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
        />
      </label>
      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? 'Saving...' : 'Reset password'}
      </button>
    </form>
  );
}
