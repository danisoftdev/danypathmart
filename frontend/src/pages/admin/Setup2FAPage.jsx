import { useNavigate } from 'react-router-dom';
import TwoFactorSetup from '../../components/auth/TwoFactorSetup';
import { useAuthStore } from '../../store/authStore';

export default function Setup2FAPage() {
  const navigate = useNavigate();
  const loadMe = useAuthStore((s) => s.loadMe);

  const handleComplete = async () => {
    await loadMe();
    navigate('/dashboard', { replace: true });
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
