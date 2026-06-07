/** Compact print / CSV action buttons for admin and customer views. */
export default function PrintExportActions({ actions, className = '' }) {
  if (!actions?.length) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {actions.map(({ label, onClick, disabled, variant = 'outline' }) => (
        <button
          key={label}
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={
            variant === 'primary'
              ? 'btn-primary px-3 py-1.5 text-xs'
              : 'rounded-lg border border-black/15 bg-white px-3 py-1.5 text-xs font-bold hover:bg-black/[0.03] disabled:opacity-50 dark:border-white/15 dark:bg-[#1E1E1E]'
          }
        >
          {label}
        </button>
      ))}
    </div>
  );
}
