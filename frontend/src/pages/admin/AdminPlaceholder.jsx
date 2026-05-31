import { DashboardStatsSkeleton } from '../../components/ui/Skeleton';

export default function AdminPlaceholder({ title, description }) {
  return (
    <div>
      <DashboardStatsSkeleton count={4} />
      <div className="card-brand mt-6 max-w-xl p-6">
        <h1 className="text-xl font-bold text-[#111111] dark:text-white">{title}</h1>
        <p className="mt-2 text-sm text-muted">
          {description || 'This admin section is coming in the next build.'}
        </p>
        <p className="mt-4 text-xs text-subtle">
          Your super admin account already has full access — the UI for this panel will be wired up shortly.
        </p>
      </div>
    </div>
  );
}
