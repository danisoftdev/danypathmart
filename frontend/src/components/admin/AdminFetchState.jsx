import { DashboardStatsSkeleton, AdminTableSkeleton } from '../ui/Skeleton';

/** Visible loading / error states so admin pages never look "blank". */
export function AdminPageLoading({ variant = 'stats', rows = 5, cols = 5 }) {
  if (variant === 'table') return <AdminTableSkeleton rows={rows} cols={cols} />;
  if (variant === 'form') return <DashboardStatsSkeleton count={2} />;
  return <DashboardStatsSkeleton count={4} />;
}

export function AdminPageError({ message, detail }) {
  const isServer = typeof detail === 'string' && /internal server|500|load failed/i.test(detail);
  return (
    <div className="admin-panel border-brand-red/30 bg-brand-red/5">
      <p className="font-bold text-brand-red">{message || 'Could not load this section.'}</p>
      {detail && <p className="mt-2 text-sm text-muted">{detail}</p>}
      {isServer ? (
        <p className="mt-3 text-xs text-muted">
          On the server, run: <code className="text-[11px]">php scripts/migrate-all.php</code> then upload the latest{' '}
          <code className="text-[11px]">api/helpers/CompanySettingsService.php</code> and{' '}
          <code className="text-[11px]">api/admin/company-settings/index.php</code>.
        </p>
      ) : (
        <p className="mt-3 text-xs text-muted">
          Try logging out and back in. If you just deployed, hard-refresh (Ctrl+F5).
        </p>
      )}
    </div>
  );
}
