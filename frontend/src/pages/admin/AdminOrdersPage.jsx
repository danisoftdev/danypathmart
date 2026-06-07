import { useMemo, useState } from 'react';
import { useAdminOrders, useAdminOrder, useUpdateAdminOrderStatus, useRefundOrderToWallet, useReviveOrder, useConfirmBankTransfer } from '../../hooks/admin';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminSearchBar from '../../components/admin/AdminSearchBar';
import AdminTable, { AdminTableCell, AdminTableRow } from '../../components/admin/AdminTable';
import AdminFilterBar, { AdminFilterSelect } from '../../components/admin/AdminFilterBar';
import PrintExportActions from '../../components/ui/PrintExportActions';
import { formatPrice, resolveImageUrl } from '../../lib/currency';
import { downloadGroupRosterCsv } from '../../lib/csvExport';
import {
  isGroupOrder,
  printGroupRoster,
  printPackingSlip,
  rosterLinesFromOrder,
} from '../../lib/orderDocuments';
import { downloadAdminOrdersExport } from '../../lib/ordersExport';
import ExportColumnModal from '../../components/admin/ExportColumnModal';
import { useCompanyStore } from '../../store/companyStore';
import { AdminPageError, AdminPageLoading } from '../../components/admin/AdminFetchState';
import EmptyState from '../../components/ui/EmptyState';

import { ADMIN_ORDER_STATUSES } from '../../lib/orderStatus';

const STATUSES = ADMIN_ORDER_STATUSES;

function StatusPill({ status }) {
  const styles = {
    pending: 'bg-brand-gold/20 text-amber-800',
    delivered: 'bg-brand-green/15 text-brand-green',
    cancelled: 'bg-brand-red/15 text-brand-red',
  };
  const cls = styles[status] || 'bg-black/10 text-muted';
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${cls}`}>
      {(status || '').replace(/_/g, ' ')}
    </span>
  );
}

function OrderManageModal({ orderId, onClose }) {
  const company = useCompanyStore((s) => s.company);
  const { data: order, isLoading, refetch } = useAdminOrder(orderId);
  const updateStatus = useUpdateAdminOrderStatus();
  const refundWallet = useRefundOrderToWallet();
  const reviveOrder = useReviveOrder();
  const confirmBank = useConfirmBankTransfer();
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [reviveReason, setReviveReason] = useState('');
  const [refundSuccess, setRefundSuccess] = useState('');
  const effectiveStatus = status || order?.status || 'placed';

  const refunded = order?.wallet_refunded_total ?? 0;
  const remaining = order ? Math.max(0, Number(order.total) - refunded) : 0;

  const save = async () => {
    setError('');
    if (effectiveStatus === 'cancelled' && !note.trim()) {
      return setError('Cancellation reason is required so the customer knows why.');
    }
    try {
      await updateStatus.mutateAsync({ id: orderId, status: effectiveStatus, note });
      onClose(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update order.');
    }
  };

  const doRevive = async () => {
    setError('');
    setRefundSuccess('');
    try {
      const res = await reviveOrder.mutateAsync({ id: orderId, reason: reviveReason.trim() });
      setRefundSuccess(res.message || 'Order revived.');
      setReviveReason('');
      refetch();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not revive order.');
    }
  };

  const creditWallet = async () => {
    setError('');
    setRefundSuccess('');
    try {
      const res = await refundWallet.mutateAsync({
        id: orderId,
        amount: Number(refundAmount),
        reason: refundReason.trim(),
      });
      setRefundSuccess(res.message || 'Wallet credited.');
      setRefundAmount('');
      setRefundReason('');
      refetch();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not credit wallet.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 dark:bg-[#1E1E1E] sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-extrabold">Order #{orderId}</h2>
        {isLoading || !order ? (
          <p className="mt-4 text-sm text-muted">Loading order…</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">
              {order.customer?.name} · {order.customer?.email}
            </p>
            <p className="mt-1 text-lg font-extrabold text-brand-green">{formatPrice(order.total)}</p>

            <PrintExportActions
              className="mt-4"
              actions={[
                {
                  label: 'Print packing slip',
                  onClick: () => printPackingSlip(order, company),
                },
                ...(isGroupOrder(order)
                  ? [
                      {
                        label: 'Print roster',
                        onClick: () =>
                          printGroupRoster({
                            organizationName: order.organization_name,
                            order,
                            company,
                          }),
                      },
                      {
                        label: 'Export roster CSV',
                        onClick: () =>
                          downloadGroupRosterCsv(
                            order.organization_name,
                            rosterLinesFromOrder(order),
                            order.id
                          ),
                      },
                    ]
                  : []),
              ]}
            />

            <p className="mt-1 text-xs capitalize text-muted">
              Payment: {order.payment_status?.replace(/_/g, ' ')}
              {order.payment_method && ` · ${order.payment_method.replace(/_/g, ' ')}`}
              {(order.wallet_paid ?? 0) > 0 && ` · ${formatPrice(order.wallet_paid)} from wallet`}
              {refunded > 0 && ` · ${formatPrice(refunded)} credited to wallet`}
            </p>
            {order.bank_transfer_ref && order.payment_status !== 'paid' && (
              <p className="mt-1 text-xs text-muted">
                Bank ref: <span className="font-mono font-bold">{order.bank_transfer_ref}</span>
              </p>
            )}
            <ul className="mt-4 space-y-2">
              {order.items?.map((it) => (
                <li key={it.id} className="flex items-center gap-3 text-sm">
                  {it.image && (
                    <img src={resolveImageUrl(it.image)} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  )}
                  <span className="flex-1">{it.name} × {it.quantity}</span>
                </li>
              ))}
            </ul>
            <label className="mt-5 block text-sm">
              <span className="mb-1 block font-bold">Update status</span>
              <select value={effectiveStatus} onChange={(e) => setStatus(e.target.value)} className="admin-filter-select w-full capitalize">
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-sm">
              <span className="mb-1 block font-bold">
                {effectiveStatus === 'cancelled' ? 'Cancellation reason (required)' : 'Tracking note (optional)'}
              </span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="input-field text-sm" placeholder={effectiveStatus === 'cancelled' ? 'Tell the customer why…' : 'Customer-visible update…'} />
            </label>

            {(order.wallet_refunds?.length > 0 || refunded > 0) && (
              <div className="mt-4 rounded-xl border border-black/8 p-3 dark:border-white/10">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Wallet refunds on this order</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {order.wallet_refunds?.map((r) => (
                    <li key={r.id} className="flex justify-between gap-2">
                      <span className="text-muted">{r.note || 'Refund'}</span>
                      <span className="font-bold text-brand-green">{formatPrice(r.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {order.can_confirm_bank_transfer && (
              <div className="mt-5 rounded-xl border border-brand-green/30 bg-brand-green/5 p-4">
                <p className="text-sm font-bold">Confirm bank transfer</p>
                <p className="mt-1 text-xs text-muted">
                  Customer reference: <span className="font-mono">{order.bank_transfer_ref}</span>
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    setError('');
                    setRefundSuccess('');
                    try {
                      const res = await confirmBank.mutateAsync(orderId);
                      setRefundSuccess(res.message || 'Bank transfer confirmed.');
                      refetch();
                    } catch (err) {
                      setError(err.response?.data?.message || 'Could not confirm transfer.');
                    }
                  }}
                  disabled={confirmBank.isPending}
                  className="btn-primary mt-3 w-full py-2 text-sm"
                >
                  {confirmBank.isPending ? 'Confirming…' : 'Mark bank transfer as paid'}
                </button>
              </div>
            )}

            {order.can_revive && (
              <div className="mt-5 rounded-xl border border-brand-green/30 bg-brand-green/5 p-4">
                <p className="text-sm font-bold">Revive customer-cancelled order</p>
                <p className="mt-1 text-xs text-muted">Only orders the buyer cancelled can be restored.</p>
                <input
                  className="input-field mt-3 text-sm"
                  value={reviveReason}
                  onChange={(e) => setReviveReason(e.target.value)}
                  placeholder="Reason for reviving (required)"
                />
                <button
                  type="button"
                  onClick={doRevive}
                  disabled={reviveOrder.isPending || !reviveReason.trim()}
                  className="btn-primary mt-3 w-full py-2 text-sm"
                >
                  {reviveOrder.isPending ? 'Reviving…' : 'Revive order'}
                </button>
              </div>
            )}

            {remaining > 0 && (
              <div className="mt-5 rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-4">
                <p className="text-sm font-bold">Refund to customer wallet</p>
                <p className="mt-1 text-xs text-muted">
                  For returns, delays, or out-of-stock items. Up to {formatPrice(remaining)} remaining on this order.
                </p>
                <label className="mt-3 block text-sm">
                  <span className="mb-1 block font-semibold">Amount (GHS)</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={remaining}
                    className="input-field text-sm"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    placeholder={remaining.toFixed(2)}
                  />
                </label>
                <label className="mt-2 block text-sm">
                  <span className="mb-1 block font-semibold">Reason</span>
                  <input
                    className="input-field text-sm"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="e.g. Return approved, item unavailable"
                  />
                </label>
                <button
                  type="button"
                  onClick={creditWallet}
                  disabled={refundWallet.isPending || !refundAmount || !refundReason.trim()}
                  className="mt-3 w-full rounded-xl border-2 border-brand-gold bg-brand-gold/10 py-2 text-sm font-bold text-amber-900 disabled:opacity-50"
                >
                  {refundWallet.isPending ? 'Crediting…' : 'Credit to wallet'}
                </button>
              </div>
            )}

            {refundSuccess && (
              <p className="mt-3 rounded-xl bg-brand-green/10 px-3 py-2 text-sm font-medium text-brand-green">{refundSuccess}</p>
            )}
            {error && <p className="mt-2 text-sm text-brand-red">{error}</p>}
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={save} disabled={updateStatus.isPending} className="btn-primary flex-1">
                {updateStatus.isPending ? 'Saving…' : 'Save update'}
              </button>
              <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2 font-bold">Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminOrdersPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeId, setActiveId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const params = useMemo(
    () => ({ search: search.trim() || undefined, status: statusFilter || undefined }),
    [search, statusFilter]
  );
  const { data: orders, isPending, isError, error, isFetching } = useAdminOrders(params);

  const exportCsv = async (columnKeys) => {
    setExporting(true);
    try {
      await downloadAdminOrdersExport(params, columnKeys);
      setExportModalOpen(false);
    } catch {
      window.alert('Could not export orders. Try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <AdminPageHeader title="Orders" subtitle="View all orders, update status, and add tracking notes.">
        <div className="flex flex-wrap items-end gap-3">
          <AdminSearchBar value={search} onChange={setSearch} placeholder="Search order # or customer…" className="flex-1 sm:max-w-xs" />
          <AdminFilterBar>
            <AdminFilterSelect value={statusFilter} onChange={setStatusFilter} label="Status">
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </AdminFilterSelect>
          </AdminFilterBar>
          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            disabled={exporting}
            className="rounded-lg border border-black/15 bg-white px-4 py-2 text-sm font-bold hover:bg-black/[0.03] disabled:opacity-50 dark:border-white/15 dark:bg-[#1E1E1E]"
          >
            Export CSV
          </button>
        </div>
      </AdminPageHeader>

      <ExportColumnModal
        open={exportModalOpen}
        type="orders"
        onClose={() => setExportModalOpen(false)}
        onExport={exportCsv}
        exporting={exporting}
      />

      {(isPending && orders == null) ? (
        <AdminPageLoading variant="table" rows={6} cols={6} />
      ) : isError && orders == null ? (
        <AdminPageError
          message="Could not load orders."
          detail={error?.response?.data?.message}
        />
      ) : !orders?.length ? (
        <EmptyState title="No orders yet" message="Customer orders will appear here as they are placed." />
      ) : (
        <>
          {isFetching && (
            <p className="mb-3 text-xs font-medium text-muted">Refreshing…</p>
          )}
        <AdminTable
          columns={[
            { key: 'id', label: 'Order' },
            { key: 'customer', label: 'Customer' },
            { key: 'total', label: 'Total' },
            { key: 'status', label: 'Status' },
            { key: 'payment', label: 'Payment', className: 'hidden md:table-cell' },
            { key: 'date', label: 'Date', className: 'hidden sm:table-cell' },
          ]}
        >
          {orders.map((o) => (
            <AdminTableRow key={o.id} onClick={() => setActiveId(o.id)}>
              <AdminTableCell className="font-bold">#{o.id}</AdminTableCell>
              <AdminTableCell>
                <p className="font-medium">{o.customer?.name}</p>
                <p className="text-xs text-muted">{o.customer?.email}</p>
              </AdminTableCell>
              <AdminTableCell className="font-bold text-brand-green">{formatPrice(o.total)}</AdminTableCell>
              <AdminTableCell><StatusPill status={o.status} /></AdminTableCell>
              <AdminTableCell className="hidden capitalize md:table-cell">{o.payment_status}</AdminTableCell>
              <AdminTableCell className="hidden text-muted sm:table-cell">{o.created_at}</AdminTableCell>
            </AdminTableRow>
          ))}
        </AdminTable>
        </>
      )}

      {activeId && <OrderManageModal orderId={activeId} onClose={() => setActiveId(null)} />}
    </div>
  );
}
