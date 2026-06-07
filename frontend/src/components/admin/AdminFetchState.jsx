import { DashboardStatsSkeleton, AdminTableSkeleton } from '../ui/Skeleton';

/** Visible loading / error states so admin pages never look "blank". */
export function AdminPageLoading({ variant = 'stats', rows = 5, cols = 5 }) {
  if (variant === 'table') return <AdminTableSkeleton rows={rows} cols={cols} />;
  if (variant === 'form') return <DashboardStatsSkeleton count={2} />;
  return <DashboardStatsSkeleton count={4} />;
}

export function AdminPageError({ message, detail }) {
  return (
    <div className="admin-panel border-brand-red/30 bg-brand-red/5">
      <p className="font-bold text-brand-red">{message || 'Could not load this section.'}</p>
      {detail && <p className="mt-2 text-sm text-muted">{detail}</p>}
      <p className="mt-3 text-xs text-muted">
        If this persists, restart the backend server so new admin API routes are registered.
      </p>
    </div>
  );
}
