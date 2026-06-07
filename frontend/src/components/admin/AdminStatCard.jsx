import { Link } from 'react-router-dom';

export default function AdminStatCard({
  label,
  value,
  change,
  icon,
  tone = 'green',
  variant = 'stat',
  to,
  badge,
  external,
}) {
  const tones = {
    green: 'from-brand-green/12 to-brand-green/4 border-brand-green/25 text-brand-green',
    gold: 'from-brand-gold/18 to-brand-gold/6 border-brand-gold/35 text-amber-900 dark:text-brand-gold',
    red: 'from-brand-red/12 to-brand-red/4 border-brand-red/25 text-brand-red',
    emerald: 'from-brand-emerald/12 to-brand-emerald/4 border-brand-emerald/25 text-brand-emerald',
    orange: 'from-brand-orange/12 to-brand-orange/4 border-brand-orange/30 text-brand-orange',
    purple: 'from-brand-purple/12 to-brand-purple/4 border-brand-purple/25 text-brand-purple',
    rose: 'from-brand-rose/12 to-brand-rose/4 border-brand-rose/25 text-brand-rose',
    neutral: 'from-black/[0.03] to-transparent border-black/8 text-[#111111] dark:border-white/10 dark:text-white',
  };

  const isNav = variant === 'nav';

  const body = (
    <div className={`admin-stat-card bg-gradient-to-br ${tones[tone] || tones.neutral}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {isNav ? (
            <>
              <p className="flex items-center gap-2 text-lg font-extrabold leading-snug">
                <span className="truncate">{label}</span>
                {badge > 0 && (
                  <span className="inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-white/80 px-1.5 text-[10px] font-bold text-[#111111] dark:bg-black/30 dark:text-white">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </p>
              {change && <p className="mt-2 text-xs font-medium leading-relaxed opacity-75">{change}</p>}
            </>
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</p>
              <p className="mt-2 flex items-center gap-2 text-2xl font-extrabold">
                <span className="truncate">{value}</span>
                {badge > 0 && (
                  <span className="inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-brand-gold px-1.5 text-[10px] font-bold text-black">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </p>
              {change && <p className="mt-1 text-xs font-medium opacity-70">{change}</p>}
            </>
          )}
        </div>
        {icon && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/70 text-lg shadow-sm dark:bg-black/25">
            {icon}
          </span>
        )}
      </div>
    </div>
  );

  if (!to) return body;

  if (external) {
    return (
      <a href={to} className="admin-stat-card-link">
        {body}
      </a>
    );
  }

  return (
    <Link to={to} className="admin-stat-card-link">
      {body}
    </Link>
  );
}
