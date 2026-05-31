import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import OTPInput from '../../components/auth/OTPInput';
import { useAuthStore } from '../../store/authStore';

export default function VerifyEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  const userId = location.state?.userId;
  const email = location.state?.email;

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (countdown <= 0) return undefined;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const verify = async (code) => {
    if (submitting || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setError('');
    try {
      const { data } = await api.post('/auth/verify-email', { user_id: userId, otp: code });
      setSession(data);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid verification code.');
      submittedRef.current = false;
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setError('');
    setInfo('');
    try {
      await api.post('/auth/resend-otp', { user_id: userId });
      setInfo('A new code has been sent to your email.');
      setCountdown(60);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resend the code.');
    }
  };

  if (!userId) {
    return (
      <div className="auth-card text-center">
        <h1 className="mb-2 text-xl font-bold">Verification link expired</h1>
        <p className="mb-4 text-sm text-muted">
          Please register again to receive a new code.
        </p>
        <Link to="/register" className="btn-primary inline-block">Go to register</Link>
      </div>
    );
  }

  return (
    <div className="auth-card text-center">
      <h1 className="mb-1 text-2xl font-bold">Verify your email</h1>
      <p className="mb-6 text-sm text-muted">
        Enter the 6-digit code we sent to {email ? <strong>{email}</strong> : 'your email'}.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-brand-red/10 px-3 py-2 text-sm text-brand-red">{error}</div>
      )}
      {info && (
        <div className="mb-4 rounded-lg bg-brand-emerald/10 px-3 py-2 text-sm text-brand-emerald">{info}</div>
      )}

      <OTPInput onComplete={verify} disabled={submitting} />

      <div className="mt-6 text-sm text-muted">
        {countdown > 0 ? (
          <span>Resend code in {countdown}s</span>
        ) : (
          <button type="button" onClick={resend} className="font-semibold text-brand-green">
            Resend code
          </button>
        )}
      </div>
    </div>
  );
}
