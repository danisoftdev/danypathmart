import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { homePathForUser } from '../../lib/permissions';
import { AuthAlert } from '../../components/auth/FormField';

export default function OAuthCallbackPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const oauthExchange = useAuthStore((s) => s.oauthExchange);
  const [error, setError] = useState('');

  useEffect(() => {
    const ticket = params.get('ticket');
    const err = params.get('error');

    if (err) {
      setError(decodeURIComponent(err.replace(/\+/g, ' ')));
      return;
    }

    if (!ticket) {
      setError('Missing sign-in ticket. Please try again.');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const user = await oauthExchange(ticket);
        if (!cancelled) {
          navigate(homePathForUser(user), { replace: true });
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.response?.data?.message || 'Could not complete sign-in. Please try again.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params, oauthExchange, navigate]);

  return (
    <div className="auth-card-lg text-center">
      <h1 className="text-2xl font-extrabold">Signing you in…</h1>
      {error ? (
        <>
          <AuthAlert type="error">{error}</AuthAlert>
          <Link to="/login" className="btn-primary mt-6 inline-flex min-h-[48px] items-center px-6">
            Back to sign in
          </Link>
        </>
      ) : (
        <p className="mt-3 text-muted">Completing your secure sign-in.</p>
      )}
    </div>
  );
}
