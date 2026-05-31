import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { identifier });
    } catch {
      // Enumeration-safe: always show the same confirmation.
    }
    setSent(true);
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="auth-card text-center">
        <h1 className="mb-2 text-xl font-bold">Check your email</h1>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          If an account matches that email or username, we&apos;ve sent a reset link.
        </p>
        <Link to="/login" className="btn-primary inline-block">Back to login</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="auth-card">
      <h1 className="mb-1 text-2xl font-bold">Forgot password</h1>
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        Enter your email address or username and we&apos;ll send a reset link.
      </p>
      <label className="mb-5 block">
        <span className="mb-1 block text-sm font-medium">Email or username</span>
        <input
          className="input-field"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="username"
        />
      </label>
      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? 'Sending...' : 'Send reset link'}
      </button>
      <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
        <Link to="/login" className="font-semibold text-brand-green">Back to login</Link>
      </p>
    </form>
  );
}
