export default function AdminPageAlert({ type = 'error', message, onDismiss }) {
  if (!message) return null;

  const styles = {
    error: 'bg-brand-red/10 text-brand-red',
    success: 'bg-brand-green/10 text-brand-green',
  };

  return (
    <div className={`mb-4 flex items-start justify-between gap-3 rounded-xl px-4 py-3 text-sm font-medium ${styles[type]}`}>
      <span>{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 text-lg leading-none opacity-70 hover:opacity-100"
        >
          ×
        </button>
      )}
    </div>
  );
}
