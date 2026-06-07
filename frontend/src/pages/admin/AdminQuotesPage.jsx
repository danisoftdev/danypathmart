import { useEffect, useState } from 'react';
import {
  useAdminQuote,
  useAdminQuotes,
  useApprovePayLater,
  useRejectQuote,
  useSendProforma,
} from '../../hooks/quotes';
import { useCompanySettings } from '../../hooks/admin';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminTable, { AdminTableCell, AdminTableRow } from '../../components/admin/AdminTable';
import AdminPageAlert from '../../components/admin/AdminPageAlert';
import Modal from '../../components/dashboard/Modal';
import PrintExportActions from '../../components/ui/PrintExportActions';
import { AdminTableSkeleton } from '../../components/ui/Skeleton';
import ShippingPreview from '../../components/cart/ShippingPreview';
import { formatPrice } from '../../lib/currency';
import { useInstitutionalFeatures } from '../../hooks/quotes';
import { canPrintProforma, printProforma } from '../../lib/quoteDocuments';
import { downloadAdminQuotesExport } from '../../lib/ordersExport';
import ExportColumnModal from '../../components/admin/ExportColumnModal';
import { useCompanyStore } from '../../store/companyStore';

const STATUSES = [
  { value: '', label: 'All' },
  { value: 'requested', label: 'Requested' },
  { value: 'proforma_sent', label: 'Proforma sent' },
  { value: 'approved_pay_later', label: 'Pay later' },
  { value: 'converted', label: 'Converted' },
  { value: 'rejected', label: 'Rejected' },
];

const STATUS_LABEL = {
  requested: 'Requested',
  proforma_sent: 'Proforma sent',
  approved_pay_later: 'Pay later',
  converted: 'Converted',
  rejected: 'Rejected',
};

function QuoteStatusPill({ status }) {
  const styles = {
    requested: 'bg-brand-gold/20 text-amber-900 dark:text-amber-200',
    proforma_sent: 'bg-brand-green/15 text-brand-green',
    approved_pay_later: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
    converted: 'bg-black/10 text-muted',
    rejected: 'bg-brand-red/15 text-brand-red',
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${styles[status] || 'bg-black/10 text-muted'}`}>
      {STATUS_LABEL[status] || status?.replace(/_/g, ' ')}
    </span>
  );
}

function QuoteDetailModal({ quoteId, onClose }) {
  const company = useCompanyStore((s) => s.company);
  const { data: settings } = useCompanySettings();
  const { data, isLoading } = useAdminQuote(quoteId);
  const sendProforma = useSendProforma();
  const approvePayLater = useApprovePayLater();
  const rejectQuote = useRejectQuote();
  const { data: features } = useInstitutionalFeatures();

  const quote = data?.quote;
  const [proformaNote, setProformaNote] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!quote) return;
    setProformaNote(quote.proforma_note || '');
    setAdminNotes(quote.admin_notes || '');
    setValidUntil(quote.valid_until || '');
  }, [quote]);

  if (!quoteId) return null;

  const saveProforma = async () => {
    setError('');
    setToast('');
    try {
      await sendProforma.mutateAsync({
        id: quoteId,
        proforma_note: proformaNote,
        admin_notes: adminNotes,
        valid_until: validUntil || undefined,
      });
      setToast(quote?.status === 'proforma_sent' ? 'Proforma updated.' : 'Proforma sent to customer.');
    } catch (err) {
      const data = err?.response?.data;
      const detail = Array.isArray(data?.errors) && data.errors.length > 0
        ? ' Check product catalog for unavailable items.'
        : '';
      setError((data?.message || 'Could not send proforma.') + detail);
    }
  };

  const approve = async () => {
    setError('');
    try {
      const res = await approvePayLater.mutateAsync({ id: quoteId });
      setToast(`Pay-later order #${res.order_id} created (PO ${res.po_reference || quote.quote_number}).`);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not approve.');
    }
  };

  const reject = async () => {
    setError('');
    try {
      await rejectQuote.mutateAsync({ id: quoteId, reason: rejectReason });
      setToast('Quote rejected.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not reject.');
    }
  };

  const canEdit = quote?.status === 'requested' || quote?.status === 'proforma_sent';
  const canSendProforma = quote?.status === 'requested' || quote?.status === 'proforma_sent';
  const catalogErrors = quote?.pricing?.errors?.length ?? 0;

  const companyForPrint = {
    company_name: settings?.company_name || company?.company_name,
    email: settings?.email || company?.email,
    phone: settings?.phone || company?.phone,
    address: settings?.address || company?.address,
  };
  const bankForPrint = settings
    ? {
        bank_name: settings.bank_name,
        bank_account_name: settings.bank_account_name,
        bank_account_number: settings.bank_account_number,
      }
    : {};

  const actionFooter = quote && quote.status !== 'converted' && quote.status !== 'rejected' ? (
    <div className="space-y-2">
      {error && <AdminPageAlert variant="error">{error}</AdminPageAlert>}
      {toast && <AdminPageAlert variant="success">{toast}</AdminPageAlert>}
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input-field min-w-[8rem] flex-1 py-2 text-sm"
          placeholder="Rejection reason"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
        <button
          type="button"
          onClick={reject}
          disabled={rejectQuote.isPending}
          className="shrink-0 rounded-lg px-3 py-2 text-xs font-bold text-brand-red hover:bg-brand-red/10"
        >
          Reject
        </button>
        {quote.status === 'proforma_sent' && !quote.converted_order_id && features?.institutional_pay_later_enabled !== false && (
          <>
            <span className="hidden text-xs text-muted sm:inline">
              PO ref: {quote.quote_number}
            </span>
            <button
              type="button"
              onClick={approve}
              disabled={approvePayLater.isPending}
              className="shrink-0 rounded-lg border-2 border-brand-green px-3 py-2 text-xs font-bold text-brand-green"
            >
              Approve pay-later
            </button>
          </>
        )}
        {canSendProforma && (
          <button
            type="button"
            onClick={saveProforma}
            disabled={sendProforma.isPending}
            className="btn-primary ml-auto shrink-0 px-4 py-2 text-xs"
          >
            {sendProforma.isPending
              ? 'Sending…'
              : quote.status === 'proforma_sent'
                ? 'Update proforma'
                : 'Send proforma'}
          </button>
        )}
      </div>
    </div>
  ) : null;

  return (
    <Modal
      open
      compact
      scroll
      onClose={onClose}
      title={quote ? quote.quote_number : 'Quote'}
      maxWidth="max-w-2xl"
      footer={!isLoading && quote ? actionFooter : null}
    >
      {isLoading || !quote ? (
        <p className="py-4 text-center text-sm text-muted">Loading quote…</p>
      ) : (
        <div className="space-y-2.5 text-sm">
          <div className="rounded-lg border border-black/8 bg-black/[0.02] px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{quote.organization_name}</span>
              <QuoteStatusPill status={quote.status} />
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {quote.contact_name} · {quote.contact_email}
              {data?.user ? ` · ${data.user.name}` : ''}
            </p>
          </div>

          {quote.customer_notes && (
            <p className="rounded-lg border border-black/8 px-3 py-1.5 text-xs text-muted dark:border-white/10">
              {quote.customer_notes}
            </p>
          )}

          <div className="overflow-hidden rounded-lg border border-black/8 dark:border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-black/8 bg-black/[0.02] text-[10px] font-bold uppercase tracking-wide text-muted dark:border-white/10 dark:bg-white/[0.03]">
                <tr>
                  <th className="px-3 py-1.5">Item</th>
                  <th className="px-3 py-1.5">Member</th>
                  <th className="px-3 py-1.5 text-center">Qty</th>
                  <th className="px-3 py-1.5 text-right">Line total</th>
                </tr>
              </thead>
              <tbody>
                {quote.items?.map((item) => (
                  <tr key={item.id} className="border-t border-black/5 text-sm dark:border-white/10">
                    <td className="px-3 py-1.5 font-medium">{item.product_name}</td>
                    <td className="px-3 py-1.5 text-xs text-muted">
                      {[item.recipient_name, item.size_label].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-3 py-1.5 text-center">{item.quantity}</td>
                    <td className="px-3 py-1.5 text-right text-xs">
                      {item.line_total != null ? (
                        <span>
                          {formatPrice(item.line_total)}
                          <span className="ml-1 text-muted">
                            ({item.quantity} × {formatPrice(item.unit_price)})
                          </span>
                        </span>
                      ) : item.unit_price != null ? (
                        formatPrice(item.unit_price * item.quantity)
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {quote.pricing_source === 'catalog' && catalogErrors > 0 && (
            <AdminPageAlert variant="error">
              Some products are unavailable — fix catalog before sending proforma.
            </AdminPageAlert>
          )}

          {(quote.subtotal > 0 || quote.total > 0) && (
            <ShippingPreview quote={quote} compact />
          )}

          {canEdit && (
            <div className="grid gap-2 sm:grid-cols-3">
              <label>
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted">Valid until</span>
                <input type="date" className="input-field py-2 text-sm" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
              </label>
              <label>
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted">Customer note</span>
                <input
                  className="input-field py-2 text-sm"
                  value={proformaNote}
                  onChange={(e) => setProformaNote(e.target.value)}
                  placeholder="Shown on proforma"
                />
              </label>
              <label>
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted">Internal notes</span>
                <input
                  className="input-field py-2 text-sm"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Staff only"
                />
              </label>
            </div>
          )}

          {quote.converted_order_id && (
            <p className="text-xs text-muted">Linked order #{quote.converted_order_id}</p>
          )}

          {canPrintProforma(quote) && (
            <PrintExportActions
              actions={[
                {
                  label: 'Print proforma',
                  onClick: () => printProforma(quote, companyForPrint, { bank: bankForPrint }),
                  disabled: quote.total <= 0 && quote.subtotal <= 0,
                },
              ]}
            />
          )}
        </div>
      )}
    </Modal>
  );
}

export default function AdminQuotesPage() {
  const [status, setStatus] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const { data: quotes = [], isLoading } = useAdminQuotes(status);

  const exportCsv = async (columnKeys) => {
    setExporting(true);
    try {
      await downloadAdminQuotesExport(status, columnKeys);
      setExportModalOpen(false);
    } catch {
      window.alert('Could not export quotes. Try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <AdminPageHeader
        title="Quotes & proformas"
        subtitle="Review institutional quote requests, send proformas, and approve pay-later orders."
        actions={
          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            disabled={exporting}
            className="rounded-lg border border-black/15 bg-white px-4 py-2 text-sm font-bold hover:bg-black/[0.03] disabled:opacity-50 dark:border-white/15 dark:bg-[#1E1E1E]"
          >
            Export CSV
          </button>
        }
      />

      <ExportColumnModal
        open={exportModalOpen}
        type="quotes"
        onClose={() => setExportModalOpen(false)}
        onExport={exportCsv}
        exporting={exporting}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setStatus(s.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${status === s.value ? 'bg-brand-green text-white' : 'bg-black/5 dark:bg-white/10'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <AdminTableSkeleton rows={5} />
      ) : (
        <AdminTable
          columns={[
            { key: 'quote', label: 'Quote #' },
            { key: 'org', label: 'Organization' },
            { key: 'status', label: 'Status' },
            { key: 'total', label: 'Total' },
            { key: 'date', label: 'Date' },
            { key: 'actions', label: '', className: 'text-right' },
          ]}
          emptyMessage="No quotes in this view."
        >
          {quotes.length === 0 ? (
            <AdminTableRow>
              <AdminTableCell colSpan={6} className="text-center text-muted">
                No quotes in this view.
              </AdminTableCell>
            </AdminTableRow>
          ) : (
            quotes.map((q) => (
              <AdminTableRow key={q.id} onClick={() => setSelectedId(q.id)}>
                <AdminTableCell className="font-bold text-brand-green">{q.quote_number}</AdminTableCell>
                <AdminTableCell>{q.organization_name}</AdminTableCell>
                <AdminTableCell className="capitalize">{q.status.replace(/_/g, ' ')}</AdminTableCell>
                <AdminTableCell>{q.total > 0 ? formatPrice(q.total) : '—'}</AdminTableCell>
                <AdminTableCell className="text-muted">{new Date(q.created_at).toLocaleDateString()}</AdminTableCell>
                <AdminTableCell className="text-right">
                  <span className="text-xs font-bold text-brand-green">Edit →</span>
                </AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTable>
      )}

      {selectedId && <QuoteDetailModal quoteId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
