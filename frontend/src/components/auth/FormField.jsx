export default function FormField({
  label,
  hint,
  error,
  success,
  children,
  required,
}) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 flex items-center gap-1 text-sm font-semibold text-[#111111] dark:text-white">
        {label}
        {required && <span className="text-brand-red" aria-hidden>*</span>}
      </span>
      {children}
      {error && (
        <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-brand-red" role="alert">
          {error}
        </p>
      )}
      {!error && success && (
        <p className="mt-1.5 text-xs font-medium text-brand-green">{success}</p>
      )}
      {!error && !success && hint && (
        <p className="mt-1.5 text-xs text-muted">{hint}</p>
      )}
    </label>
  );
}

export function AuthAlert({ type = 'error', children }) {
  const styles = {
    error: 'bg-brand-red/10 text-brand-red border-brand-red/20',
    success: 'bg-brand-green/10 text-brand-green border-brand-green/20',
    info: 'bg-brand-gold/10 text-[#92400E] border-brand-gold/30 dark:text-brand-gold',
  };
  return (
    <div className={`mb-4 rounded-xl border px-4 py-3 text-sm font-medium ${styles[type]}`} role="alert">
      {children}
    </div>
  );
}
