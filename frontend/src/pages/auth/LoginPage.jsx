import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useWebAuthn } from '../../hooks/useWebAuthn';
import { homePathForUser } from '../../lib/permissions';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const setSession = useAuthStore((s) => s.setSession);
  const { loginWithBiometric, isSupported } = useWebAuthn();

  const notice = location.state?.reset ? 'Password changed. Please log in.' : '';

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(form.email, form.password);
      if (res.requires2FA) {
        navigate('/2fa');
      } else {
        navigate(homePathForUser(useAuthStore.getState().user));
      }
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === 'email_unverified') {
        navigate('/verify-email', { state: { userId: data.user_id, email: form.email } });
        return;
      }
      setError(data?.message || 'Login failed. Check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  const biometricLogin = async () => {
    setError('');
    setBioLoading(true);
    try {
      const data = await loginWithBiometric();
      setSession(data);
      navigate(homePathForUser(data.user));
    } catch (err) {
      if (err?.name === 'NotAllowedError') {
        setError('Biometric prompt was cancelled.');
      } else {
        setError(err.response?.data?.message || 'Could not sign in with a passkey.');
      }
    } finally {
      setBioLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="auth-card">
      <h1 className="mb-1 text-2xl font-bold">Welcome back</h1>
      <p className="mb-6 text-sm text-muted">Log in to your DanyPathMart account.</p>

      {notice && (
        <div className="mb-4 rounded-lg bg-brand-green/10 px-3 py-2 text-sm font-medium text-brand-green">
          {notice}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-brand-red/10 px-3 py-2 text-sm text-brand-red">{error}</div>
      )}

      <label className="mb-3 block">
        <span className="mb-1 block text-sm font-medium">Email</span>
        <input type="email" className="input-field" value={form.email} onChange={set('email')} autoComplete="email" />
      </label>

      <label className="mb-2 block">
        <span className="mb-1 block text-sm font-medium">Password</span>
        <input
          type="password"
          className="input-field"
          value={form.password}
          onChange={set('password')}
          autoComplete="current-password"
        />
      </label>

      <div className="mb-5 text-right">
        <Link to="/forgot-password" className="text-sm font-medium text-brand-green">
          Forgot password?
        </Link>
      </div>

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? 'Logging in...' : 'Log in'}
      </button>

      {isSupported && (
        <>
          <div className="my-4 flex items-center gap-3 text-xs text-subtle">
            <span className="h-px flex-1 bg-[#E5E7EB] dark:bg-white/15" />
            OR
            <span className="h-px flex-1 bg-[#E5E7EB] dark:bg-white/15" />
          </div>
          <button type="button" onClick={biometricLogin} className="btn-ghost w-full" disabled={bioLoading}>
            {bioLoading ? 'Waiting for device...' : 'Login with Face ID / Fingerprint / Passkey'}
          </button>
        </>
      )}

      <p className="mt-4 text-center text-sm text-muted">
        New here?{' '}
        <Link to="/register" className="font-semibold text-brand-green">Create an account</Link>
      </p>
    </form>
  );
}
