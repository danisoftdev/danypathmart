import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../lib/api';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { identifier: identifier.trim() });
      setSent(true);
    } catch (err) {
      if (err.response?.status === 429) {
        setError(err.response?.data?.message || 'Too many requests. Please try again later.');
      } else {
        // Enumeration-safe: still show confirmation for most failures.
        setSent(true);
      }
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="auth-card text-center">
        <h1 className="mb-2 text-xl font-bold">Check your email</h1>
        <p className="mb-4 text-sm text-muted">
          If an account matches that email or username, we&apos;ve sent a <strong>6-digit code</strong> and a
          {' '}reset link. Both expire in 1 hour.
        </p>
        <button
          type="button"
          className="btn-primary w-full"
          onClick={() => navigate('/reset-password', { state: { identifier: identifier.trim() } })}
        >
          Enter code to reset
        </button>
        <p className="mt-4 text-sm text-muted">
          Or open the link from your email for one-click reset.
        </p>
        <Link to="/login" className="mt-4 inline-block text-sm font-semibold text-brand-green">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="auth-card">
      <h1 className="mb-1 text-2xl font-bold">Forgot password</h1>
      <p className="mb-6 text-sm text-muted">
        Enter your email or username. We&apos;ll send a 6-digit code and a secure reset link.
      </p>
      {error && (
        <div className="mb-4 rounded-lg bg-brand-red/10 px-3 py-2 text-sm text-brand-red">{error}</div>
      )}
      <label className="mb-5 block">
        <span className="mb-1 block text-sm font-medium">Email or username</span>
        <input
          className="input-field"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="username"
          required
        />
      </label>
      <button type="submit" className="btn-primary w-full" disabled={loading || !identifier.trim()}>
        {loading ? 'Sending...' : 'Send reset email'}
      </button>
      <p className="mt-4 text-center text-sm text-muted">
        <Link to="/login" className="font-semibold text-brand-green">Back to login</Link>
      </p>
    </form>
  );
}
