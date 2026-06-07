import { Link } from 'react-router-dom';
import { useQuotes } from '../../hooks/quotes';
import { formatPrice } from '../../lib/currency';
import { FormPanelSkeleton } from '../../components/ui/Skeleton';

const STATUS_LABEL = {
  requested: 'Requested',
  proforma_sent: 'Proforma sent',
  approved_pay_later: 'Approved — pay later',
  converted: 'Converted to order',
  rejected: 'Rejected',
};

export default function QuotesPage() {
  const { data: quotes = [], isLoading } = useQuotes();

  if (isLoading) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold">Quotes</h1>
        <FormPanelSkeleton className="mt-6" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Quotes &amp; proformas</h1>
          <p className="mt-1 text-sm text-muted">Institutional quote requests and proforma invoices.</p>
        </div>
        <Link to="/group-order" className="btn-primary text-sm">
          New group / quote
        </Link>
      </div>

      {quotes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/15 p-8 text-center dark:border-white/15">
          <p className="font-semibold">No quotes yet</p>
          <p className="mt-1 text-sm text-muted">Start a group order and request a proforma for your organization.</p>
          <Link to="/group-order" className="mt-4 inline-block font-bold text-brand-green hover:underline">
            Group order →
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {quotes.map((q) => (
            <li key={q.id}>
              <Link
                to={`/dashboard/quotes/${q.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/8 bg-white p-4 transition hover:border-brand-green/30 dark:border-white/10 dark:bg-[#1E1E1E]"
              >
                <div>
                  <p className="font-bold">{q.organization_name}</p>
                  <p className="text-sm text-muted">
                    {q.quote_number} · {STATUS_LABEL[q.status] || q.status}
                  </p>
                </div>
                <div className="text-right">
                  {q.total > 0 && <p className="font-extrabold text-brand-green">{formatPrice(q.total)}</p>}
                  <p className="text-xs text-muted">{new Date(q.created_at).toLocaleDateString()}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
