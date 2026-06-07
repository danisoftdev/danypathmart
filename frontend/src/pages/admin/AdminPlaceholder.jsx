import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { DashboardStatsSkeleton } from '../../components/ui/Skeleton';

export default function AdminPlaceholder({ title, description, icon = '🚧' }) {
  return (
    <div>
      <AdminPageHeader title={title} subtitle={description} />

      <DashboardStatsSkeleton count={4} />

      <div className="admin-coming-soon mt-6">
        <span className="text-4xl">{icon}</span>
        <h2 className="mt-4 text-lg font-extrabold text-brand-green">Panel UI ready — data wiring next</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Your account already has the correct permissions. This section will connect to backend APIs in a future release — the enterprise layout is in place.
        </p>
      </div>
    </div>
  );
}
