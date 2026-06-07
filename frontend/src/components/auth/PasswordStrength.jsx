import { scorePassword } from '../../lib/password';
import { meetsPolicy } from '../../lib/password';

const LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
const COLORS = ['#EF4444', '#F97316', '#F59E0B', '#10B981', '#2C7A4B'];

const RULES = [
  { test: (p) => p.length >= 8, label: 'At least 8 characters' },
  { test: (p) => /[A-Z]/.test(p), label: 'One uppercase letter' },
  { test: (p) => /[0-9]/.test(p), label: 'One number' },
];

export default function PasswordStrength({ password, showRules = false }) {
  const score = scorePassword(password);
  if (!password && !showRules) return null;

  return (
    <div className="mt-3 rounded-xl bg-[#FFF9F3] p-3 dark:bg-[#121212]">
      {password && (
        <>
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-muted">Password strength</span>
            <span style={{ color: COLORS[score] }}>{LABELS[score]}</span>
          </div>
          <div className="mt-2 flex h-2 gap-1">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex-1 rounded-full transition-all duration-300"
                style={{ backgroundColor: i < score ? COLORS[score] : '#E5E7EB' }}
              />
            ))}
          </div>
        </>
      )}
      {(showRules || password) && (
        <ul className="mt-3 space-y-1.5">
          {RULES.map((rule) => {
            const ok = password && rule.test(password);
            return (
              <li key={rule.label} className={`flex items-center gap-2 text-xs ${ok ? 'text-brand-green' : 'text-muted'}`}>
                <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${ok ? 'bg-brand-green text-white' : 'bg-[#E5E7EB] dark:bg-[#2A2A2A]'}`}>
                  {ok ? '✓' : ''}
                </span>
                {rule.label}
              </li>
            );
          })}
          {password && (
            <li className={`flex items-center gap-2 text-xs ${meetsPolicy(password) ? 'text-brand-green' : 'text-muted'}`}>
              <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${meetsPolicy(password) ? 'bg-brand-green text-white' : 'bg-[#E5E7EB] dark:bg-[#2A2A2A]'}`}>
                {meetsPolicy(password) ? '✓' : ''}
              </span>
              Meets account policy
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
