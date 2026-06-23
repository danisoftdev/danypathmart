import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminReviews, useModerateReview } from '../../hooks/trustMessaging';
import { useAuthStore } from '../../store/authStore';
import { hasAnyPermission } from '../../lib/permissions';
import AdminPageHeader from '../../components/admin/AdminPageHeader';

export default function AdminReviewsPage() {
  const user = useAuthStore((s) => s.user);
  const canView = hasAnyPermission(user, ['manage_product_reviews', 'view_products']);
  const canModerate = hasAnyPermission(user, ['manage_product_reviews']);
  const { data, isLoading } = useAdminReviews(canView);
  const moderate = useModerateReview();
  const [msg, setMsg] = useState('');

  if (!canView) return <Navigate to="/admin/dashboard" replace />;

  const reviews = data?.data ?? [];

  const act = async (id, status) => {
    setMsg('');
    try {
      await moderate.mutateAsync({ review_id: id, status });
      setMsg('Review updated.');
    } catch (e) {
      setMsg(e.response?.data?.message || 'Failed.');
    }
  };

  return (
    <div>
      <AdminPageHeader title="Product reviews" subtitle="Approve or reject buyer reviews before they appear on products." />
      {msg && <p className="mb-4 text-sm text-brand-green">{msg}</p>}
      {isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-muted">No pending reviews.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="admin-panel text-sm">
              <p className="font-bold">{r.product_name || `Product #${r.product_id}`}</p>
              <p className="text-muted">{r.user_name} · {r.rating}/5 {r.verified_purchase ? '· Verified purchase' : ''}</p>
              {r.title && <p className="mt-1 font-semibold">{r.title}</p>}
              {r.body && <p className="mt-1 whitespace-pre-wrap">{r.body}</p>}
              {canModerate && (
                <div className="mt-3 flex gap-2">
                  <button type="button" className="btn-primary px-3 py-1 text-xs" onClick={() => act(r.id, 'approved')}>Approve</button>
                  <button type="button" className="rounded-lg border border-brand-red px-3 py-1 text-xs font-bold text-brand-red" onClick={() => act(r.id, 'rejected')}>Reject</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
