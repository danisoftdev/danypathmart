import { useNavigate } from 'react-router-dom';
import TwoFactorSetup from '../../components/auth/TwoFactorSetup';
import { useAuthStore } from '../../store/authStore';
import { homePathForUser } from '../../lib/permissions';

export default function Setup2FAPage() {
  const navigate = useNavigate();
  const loadMe = useAuthStore((s) => s.loadMe);

  const handleComplete = async () => {
    const fresh = await loadMe();
    navigate(homePathForUser(fresh), { replace: true });
  };

  return (
    <div className="auth-card">
      <div className="mb-4 rounded-lg bg-brand-gold/15 px-3 py-2 text-sm font-medium text-brand-orange">
        Admin accounts require two-factor authentication. Please set it up to continue.
      </div>
      <TwoFactorSetup onComplete={handleComplete} />
    </div>
  );
}
