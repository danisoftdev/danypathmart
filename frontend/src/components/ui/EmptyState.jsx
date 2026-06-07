import { Link } from 'react-router-dom';

function EmptyIcon({ className = 'h-12 w-12' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8M12 8v8" />
    </svg>
  );
}

/**
 * Reusable empty state: green outline icon + message + optional CTA.
 */
export default function EmptyState({ title, message, actionLabel, actionTo, onAction, icon: Icon = EmptyIcon }) {
  const Action = actionTo ? (
    <Link to={actionTo} className="btn-primary mt-6 inline-block">
      {actionLabel}
    </Link>
  ) : onAction ? (
    <button type="button" onClick={onAction} className="btn-primary mt-6">
      {actionLabel}
    </button>
  ) : null;

  return (
    <div className="card-brand mx-auto max-w-md px-6 py-12 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-brand-green text-brand-green">
        <Icon className="h-8 w-8" />
      </div>
      <h2 className="text-lg font-semibold text-[#111111] dark:text-white">{title}</h2>
      {message && <p className="mt-2 text-sm text-muted">{message}</p>}
      {Action}
    </div>
  );
}
