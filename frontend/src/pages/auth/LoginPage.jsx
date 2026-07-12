import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useWebAuthn } from '../../hooks/useWebAuthn';
import { homePathForUser } from '../../lib/permissions';
import FormField, { AuthAlert } from '../../components/auth/FormField';
import SocialAuthButtons, { SocialAuthSetupHint } from '../../components/auth/SocialAuthButtons';

const REMEMBER_KEY = 'dpm_remember_email';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const setSession = useAuthStore((s) => s.setSession);
  const { loginWithBiometric, isSupported } = useWebAuthn();

  const notice =
    location.state?.message ||
    (location.state?.reset ? 'Password changed. Please log in.' : '');

  const [form, setForm] = useState(() => {
    const saved = localStorage.getItem(REMEMBER_KEY);
    return { email: saved || '', password: '' };
  });
  const [remember, setRemember] = useState(() => !!localStorage.getItem(REMEMBER_KEY));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (remember) localStorage.setItem(REMEMBER_KEY, form.email);
    else localStorage.removeItem(REMEMBER_KEY);

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
        setError(err.response?.data?.message || 'Could not sign in with biometrics.');
      }
    } finally {
      setBioLoading(false);
    }
  };

  const passkeyLogin = async () => {
    setError('');
    setBioLoading(true);
    try {
      const data = await loginWithBiometric();
      setSession(data);
      navigate(homePathForUser(data.user));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not sign in with passkey.');
    } finally {
      setBioLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="auth-card-lg">
      <div className="mb-8 text-center sm:text-left">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Welcome back</h1>
        <p className="mt-2 text-base text-muted">Sign in to track orders, save favourites, and shop groceries &amp; marketplace finds across Ghana.</p>
      </div>

      {notice && <AuthAlert type="success">{notice}</AuthAlert>}
      {error && <AuthAlert type="error">{error}</AuthAlert>}

      <FormField label="Email address" required>
        <input
          type="email"
          className="input-field min-h-[48px] text-base"
          value={form.email}
          onChange={set('email')}
          autoComplete="email"
          placeholder="you@example.com"
        />
      </FormField>

      <FormField label="Password" required>
        <input
          type="password"
          className="input-field min-h-[48px] text-base"
          value={form.password}
          onChange={set('password')}
          autoComplete="current-password"
          placeholder="Your password"
        />
      </FormField>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 accent-brand-green"
          />
          Remember me
        </label>
        <Link to="/forgot-password" className="text-sm font-semibold text-brand-green hover:underline">
          Forgot password?
        </Link>
      </div>

      <button type="submit" className="btn-primary min-h-[48px] w-full text-base" disabled={loading}>
        {loading ? 'Signing in...' : 'Sign in with email'}
      </button>

      <div className="mt-6">
        <SocialAuthButtons mode="login" />
      </div>

      {isSupported && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-subtle">
            <span className="h-px flex-1 bg-[#E5E7EB] dark:bg-white/15" />
            Device sign-in
            <span className="h-px flex-1 bg-[#E5E7EB] dark:bg-white/15" />
          </div>
          <button
            type="button"
            onClick={passkeyLogin}
            disabled={bioLoading}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border-2 border-brand-green/30 bg-brand-green/5 text-sm font-bold text-brand-green transition hover:bg-brand-green/10 disabled:opacity-60"
          >
            <span aria-hidden>🔑</span>
            {bioLoading ? 'Waiting for device...' : 'Sign in with passkey'}
          </button>
          <button
            type="button"
            onClick={biometricLogin}
            disabled={bioLoading}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border-2 border-black/10 text-sm font-bold transition hover:bg-black/5 disabled:opacity-60 dark:border-white/15 dark:hover:bg-white/5"
          >
            <span aria-hidden>👆</span>
            Face ID / Fingerprint
          </button>
        </div>
      )}

      <p className="mt-8 text-center text-sm text-muted">
        New to DanyPathMart?{' '}
        <Link to="/register" className="font-bold text-brand-green hover:underline">
          Create an account
        </Link>
      </p>
      <div className="mt-4">
        <SocialAuthSetupHint />
      </div>
    </form>
  );
}
