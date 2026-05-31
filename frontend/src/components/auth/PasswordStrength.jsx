import { scorePassword } from '../../lib/password';

const LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
const COLORS = ['#EF4444', '#F97316', '#F59E0B', '#10B981', '#2C7A4B'];

export default function PasswordStrength({ password }) {
  const score = scorePassword(password);
  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="flex h-1.5 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex-1 rounded-full transition-colors"
            style={{ backgroundColor: i < score ? COLORS[score] : '#E5E7EB' }}
          />
        ))}
      </div>
      <p className="mt-1 text-xs" style={{ color: COLORS[score] }}>
        {LABELS[score]}
      </p>
    </div>
  );
}
