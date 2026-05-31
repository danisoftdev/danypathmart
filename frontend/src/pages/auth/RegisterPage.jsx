import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import PasswordStrength from '../../components/auth/PasswordStrength';
import { meetsPolicy } from '../../lib/password';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm_password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) return setError('Please enter your full name.');
    if (!meetsPolicy(form.password)) {
      return setError('Password needs 8+ characters, an uppercase letter, and a number.');
    }
    if (form.password !== form.confirm_password) return setError('Passwords do not match.');

    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', form);
      navigate('/verify-email', { state: { userId: data.user_id, email: data.email } });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create your account. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="auth-card">
      <h1 className="mb-1 text-2xl font-bold">Create your account</h1>
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        Join DanyPathMart to shop insignias, uniforms and more.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-brand-red/10 px-3 py-2 text-sm text-brand-red">{error}</div>
      )}

      <label className="mb-3 block">
        <span className="mb-1 block text-sm font-medium">Full name</span>
        <input className="input-field" value={form.name} onChange={set('name')} autoComplete="name" />
      </label>

      <label className="mb-3 block">
        <span className="mb-1 block text-sm font-medium">Email</span>
        <input
          type="email"
          className="input-field"
          value={form.email}
          onChange={set('email')}
          autoComplete="email"
        />
      </label>

      <label className="mb-1 block">
        <span className="mb-1 block text-sm font-medium">Password</span>
        <input
          type="password"
          className="input-field"
          value={form.password}
          onChange={set('password')}
          autoComplete="new-password"
        />
      </label>
      <PasswordStrength password={form.password} />

      <label className="mb-5 mt-3 block">
        <span className="mb-1 block text-sm font-medium">Confirm password</span>
        <input
          type="password"
          className="input-field"
          value={form.confirm_password}
          onChange={set('confirm_password')}
          autoComplete="new-password"
        />
      </label>

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? 'Creating account...' : 'Create account'}
      </button>

      <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-brand-green">Log in</Link>
      </p>
    </form>
  );
}
