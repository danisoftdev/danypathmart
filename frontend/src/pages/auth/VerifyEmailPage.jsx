import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import OTPInput from '../../components/auth/OTPInput';
import { AuthAlert } from '../../components/auth/FormField';
import { useAuthStore } from '../../store/authStore';
import { homePathForUser } from '../../lib/permissions';

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
      navigate(homePathForUser(data.user));
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
      submittedRef.current = false;
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resend the code.');
    }
  };

  if (!userId) {
    return (
      <div className="auth-card-lg text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-gold/20 text-2xl">✉</div>
        <h1 className="text-xl font-bold">Verification link expired</h1>
        <p className="mt-2 text-sm text-muted">Please register again to receive a new code.</p>
        <Link to="/register" className="btn-primary mt-6 inline-block min-h-[48px] px-8 leading-[48px]">
          Go to register
        </Link>
      </div>
    );
  }

  return (
    <div className="auth-card-lg text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-green/10 text-3xl text-brand-green">
        ✉
      </div>
      <h1 className="text-2xl font-extrabold">Check your email</h1>
      <p className="mx-auto mt-2 max-w-sm text-base text-muted">
        Enter the 6-digit code we sent to{' '}
        {email ? <strong className="text-[#111111] dark:text-white">{email}</strong> : 'your inbox'}.
      </p>

      {error && <div className="mt-4 text-left"><AuthAlert type="error">{error}</AuthAlert></div>}
      {info && <div className="mt-4 text-left"><AuthAlert type="success">{info}</AuthAlert></div>}

      <div className="my-8">
        <OTPInput onComplete={verify} disabled={submitting} />
        {submitting && <p className="mt-4 text-sm font-medium text-brand-green">Verifying...</p>}
      </div>

      <p className="text-sm text-muted">You can paste the full code from your email.</p>

      <div className="mt-6 rounded-2xl bg-[#FFF9F3] px-4 py-4 dark:bg-[#121212]">
        {countdown > 0 ? (
          <p className="text-sm text-muted">
            Resend code in{' '}
            <span className="font-mono text-base font-bold text-brand-green">{countdown}s</span>
          </p>
        ) : (
          <button
            type="button"
            onClick={resend}
            className="text-sm font-bold text-brand-green hover:underline"
          >
            Resend verification code
          </button>
        )}
      </div>
    </div>
  );
}
