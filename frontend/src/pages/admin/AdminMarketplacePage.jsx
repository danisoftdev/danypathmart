import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  useAdminShopApplications,
  useAdminShopBilling,
  useAdminShopWithdrawals,
  useAdminShops,
  useApproveShopApplication,
  useMarketplaceListings,
  useProcessShopWithdrawal,
  useRejectShopApplication,
  useModerateListingBadge,
  useReviewMarketplaceListing,
  useUpdateAdminShop,
  useUpdateShopBillingSettings,
  useWaiveShopApplicationFee,
  useWaiveShopRenewal,
} from '../../hooks/admin';
import { useAuthStore } from '../../store/authStore';
import { hasAnyPermission, hasPermission } from '../../lib/permissions';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminPageAlert from '../../components/admin/AdminPageAlert';
import { AdminTableSkeleton } from '../../components/ui/Skeleton';
import { formatPrice } from '../../lib/currency';
import CopyableText from '../../components/ui/CopyableText';
import { resolveProductImageUrl } from '../../lib/productImages';

const TABS = [
  { id: 'applications', label: 'Applications', perm: 'ops' },
  { id: 'shops', label: 'Shops', perm: 'ops' },
  { id: 'listings', label: 'Listings', perm: 'ops' },
  { id: 'withdrawals', label: 'Withdrawals', perm: 'ops' },
  { id: 'billing', label: 'Billing', perm: 'billing' },
];

const LISTING_FILTERS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso || '—';
  }
}

function listingPromoTags(row) {
  const tags = [];
  if (row.shop_badge_hidden) {
    return ['Hidden by admin'];
  }
  if (row.shop_badge_label) {
    tags.push(row.shop_badge_label);
  }
  if (row.shop_promo_free_delivery) {
    tags.push('Free delivery');
  }
  return tags;
}

function StatusBadge({ status }) {
  const tone =
    status === 'approved' || status === 'active' || status === 'paid'
      ? 'bg-brand-green/15 text-brand-green'
      : status === 'rejected' || status === 'suspended'
        ? 'bg-brand-red/15 text-brand-red'
        : status === 'new' || status === 'pending' || status === 'requested' || status === 'pending_payment'
          ? 'bg-brand-gold/20 text-[#92400E] dark:text-brand-gold'
          : 'bg-black/5 text-muted dark:bg-white/10';
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${tone}`}>
      {status}
    </span>
  );
}

function ApplicationDetailModal({ app, onClose, onApprove, onReject, onWaive, canWaive, loading }) {
  const [note, setNote] = useState('');

  if (!app) return null;

  const paymentLabel = app.registration_fee_waived
    ? 'Waived'
    : app.registration_fee_paid
      ? 'Paid'
      : app.status === 'pending_payment'
        ? 'Awaiting payment'
        : 'Not required';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !loading && onClose()}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 dark:bg-[#1E1E1E]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Application #{app.id}</p>
            <h3 className="text-lg font-extrabold">{app.business_name}</h3>
            <StatusBadge status={app.status} />
          </div>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-muted" aria-label="Close">
            ×
          </button>
        </div>

        {app.logo_url && (
          <img
            src={resolveProductImageUrl(app.logo_url)}
            alt=""
            className="mt-4 h-16 w-16 rounded-xl object-cover"
          />
        )}

        <dl className="mt-4 space-y-2 text-sm">
          <div><dt className="text-xs font-bold uppercase text-muted">Contact</dt><dd>{app.contact_name}</dd></div>
          <div><dt className="text-xs font-bold uppercase text-muted">Email</dt><dd><CopyableText value={app.email} className="text-brand-green" /></dd></div>
          <div><dt className="text-xs font-bold uppercase text-muted">Phone</dt><dd>{app.phone}</dd></div>
          <div><dt className="text-xs font-bold uppercase text-muted">City</dt><dd>{app.city}</dd></div>
          {app.description && (
            <div><dt className="text-xs font-bold uppercase text-muted">About</dt><dd className="whitespace-pre-wrap">{app.description}</dd></div>
          )}
          {app.referred_by_shop_code && (
            <div>
              <dt className="text-xs font-bold uppercase text-muted">Referred by</dt>
              <dd className="font-semibold">{app.referred_by_shop_code}</dd>
            </div>
          )}
          {(app.bank_name || app.momo_number) && (
            <div className="rounded-xl border border-black/8 p-3 dark:border-white/10">
              <p className="text-xs font-bold uppercase text-muted">Payout details</p>
              {app.bank_name && <p className="mt-1">{app.bank_name} · {app.bank_account_name} · {app.bank_account_number}</p>}
              {app.momo_number && <p className="mt-1">MoMo: {app.momo_number}</p>}
            </div>
          )}
          <div><dt className="text-xs font-bold uppercase text-muted">Submitted</dt><dd>{formatWhen(app.created_at)}</dd></div>
          <div><dt className="text-xs font-bold uppercase text-muted">Registration fee</dt><dd>{paymentLabel}</dd></div>
        </dl>

        {app.status === 'pending_payment' && canWaive && (
          <button
            type="button"
            disabled={loading}
            onClick={() => onWaive(note)}
            className="mt-4 rounded-xl border border-brand-gold px-4 py-2 text-sm font-bold text-brand-gold"
          >
            Waive registration fee
          </button>
        )}

        {(app.status === 'new' || (app.status === 'pending_payment' && app.registration_fee_paid)) && (
          <>
            <label className="mt-4 block text-sm">
              <span className="mb-1 block font-semibold">Admin note (optional)</span>
              <textarea className="input-field w-full" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={loading} onClick={() => onApprove(note)} className="btn-primary px-4 py-2 text-sm">
                Approve & create shop
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => onReject(note)}
                className="rounded-xl border border-brand-red px-4 py-2 text-sm font-bold text-brand-red"
              >
                Reject
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminMarketplacePage() {
  const user = useAuthStore((s) => s.user);
  const canViewBilling = hasAnyPermission(user, ['view_shop_billing', 'manage_shop_fees', 'waive_shop_fees']);
  const canManageFees = hasPermission(user, 'manage_shop_fees');
  const canWaiveFees = hasPermission(user, 'waive_shop_fees');
  const canOps = hasAnyPermission(user, ['manage_marketplace', 'edit_company_settings']);
  const canAccess = canOps || canViewBilling;
  const canReviewListings = hasAnyPermission(user, ['manage_marketplace', 'approve_shop_listings', 'add_edit_products']);

  const visibleTabs = TABS.filter((t) => (t.perm === 'billing' ? canViewBilling : canOps));

  const [tab, setTab] = useState(() => (canOps ? 'applications' : 'billing'));
  const [listingFilter, setListingFilter] = useState('pending');
  const [withdrawFilter, setWithdrawFilter] = useState('requested');
  const [selectedApp, setSelectedApp] = useState(null);
  const [alert, setAlert] = useState('');
  const [alertType, setAlertType] = useState('success');

  const { data: appData, isLoading: appsLoading } = useAdminShopApplications(canAccess && tab === 'applications');
  const { data: shops = [], isLoading: shopsLoading } = useAdminShops(canAccess && tab === 'shops');
  const { data: listings = [], isLoading: listingsLoading } = useMarketplaceListings(
    listingFilter,
    canAccess && tab === 'listings' && canReviewListings
  );
  const { data: withdrawals = [], isLoading: withdrawalsLoading } = useAdminShopWithdrawals(
    withdrawFilter,
    canAccess && tab === 'withdrawals'
  );

  const approveApp = useApproveShopApplication();
  const rejectApp = useRejectShopApplication();
  const updateShop = useUpdateAdminShop();
  const reviewListing = useReviewMarketplaceListing();
  const moderateBadge = useModerateListingBadge();
  const processWithdrawal = useProcessShopWithdrawal();
  const { data: billingData, isLoading: billingLoading } = useAdminShopBilling(canAccess && tab === 'billing' && canViewBilling);
  const updateBilling = useUpdateShopBillingSettings();
  const waiveAppFee = useWaiveShopApplicationFee();
  const waiveShopRenewal = useWaiveShopRenewal();
  const [billingForm, setBillingForm] = useState(null);

  const applications = appData?.data ?? [];
  const newCount = appData?.new_count ?? 0;

  const pendingWithdrawals = useMemo(
    () => (withdrawFilter === 'requested' ? withdrawals.length : null),
    [withdrawFilter, withdrawals.length]
  );

  if (!canAccess) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const showAlert = (message, type = 'success') => {
    setAlertType(type);
    setAlert(message);
  };

  const handleApproveApp = async (note) => {
    try {
      await approveApp.mutateAsync({ id: selectedApp.id, admin_note: note || undefined });
      showAlert('Shop approved and dashboard access granted.');
      setSelectedApp(null);
    } catch (e) {
      showAlert(e.response?.data?.message || 'Could not approve application.', 'error');
    }
  };

  const handleRejectApp = async (note) => {
    try {
      await rejectApp.mutateAsync({ id: selectedApp.id, admin_note: note || undefined });
      showAlert('Application rejected.');
      setSelectedApp(null);
    } catch (e) {
      showAlert(e.response?.data?.message || 'Could not reject application.', 'error');
    }
  };

  const handleWaiveApp = async (note) => {
    try {
      await waiveAppFee.mutateAsync({ application_id: selectedApp.id, note: note || undefined });
      showAlert('Registration fee waived.');
      setSelectedApp(null);
    } catch (e) {
      showAlert(e.response?.data?.message || 'Could not waive fee.', 'error');
    }
  };

  const billingSettings = billingForm ?? billingData?.settings ?? {};
  const billingPayments = billingData?.payments ?? [];
  const billingSubscriptions = billingData?.subscriptions ?? [];

  const saveBillingSettings = async (e) => {
    e.preventDefault();
    if (!canManageFees) return;
    try {
      await updateBilling.mutateAsync(billingSettings);
      showAlert('Shop billing settings saved.');
      setBillingForm(null);
    } catch (err) {
      showAlert(err.response?.data?.message || 'Could not save billing settings.', 'error');
    }
  };

  const toggleShopPublished = async (shop) => {
    try {
      await updateShop.mutateAsync({ id: shop.id, is_published: !shop.is_published });
      showAlert('Shop updated.');
    } catch (e) {
      showAlert(e.response?.data?.message || 'Could not update shop.', 'error');
    }
  };

  const toggleShopStatus = async (shop) => {
    const next = shop.status === 'active' ? 'suspended' : 'active';
    try {
      await updateShop.mutateAsync({ id: shop.id, status: next });
      showAlert(`Shop ${next === 'active' ? 'activated' : 'suspended'}.`);
    } catch (e) {
      showAlert(e.response?.data?.message || 'Could not update shop.', 'error');
    }
  };

  return (
    <div>
      <AdminPageHeader
        title="Marketplace"
        subtitle="Review shop applications, manage sellers, approve listings, and process withdrawals."
      />

      {alert && <AdminPageAlert type={alertType} message={alert} onDismiss={() => setAlert('')} />}

      {canViewBilling && tab === 'billing' && canManageFees && (
        <p className="mb-4 text-sm text-muted">
          Toggle and fee amounts can also be edited under{' '}
          <Link to="/admin/company-settings" className="font-bold text-brand-green hover:underline">Company settings → Marketplace</Link>
          {' '}when you have <strong>manage_shop_fees</strong>.
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={tab === t.id ? 'admin-mobile-pill-active' : 'admin-mobile-pill'}
          >
            {t.label}
            {t.id === 'applications' && newCount > 0 ? ` (${newCount})` : ''}
          </button>
        ))}
      </div>

      {tab === 'applications' && (
        <>
          {appsLoading ? (
            <AdminTableSkeleton rows={5} cols={5} />
          ) : applications.length === 0 ? (
            <p className="text-sm text-muted">No shop applications yet.</p>
          ) : (
            <div className="admin-panel overflow-x-auto">
              <table className="admin-table w-full min-w-[640px] text-sm">
                <thead>
                  <tr>
                    <th>Business</th>
                    <th>Contact</th>
                    <th>City</th>
                    <th>Status</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app) => (
                    <tr
                      key={app.id}
                      className="cursor-pointer hover:bg-black/3 dark:hover:bg-white/5"
                      onClick={() => setSelectedApp(app)}
                    >
                      <td className="font-semibold">{app.business_name}</td>
                      <td>
                        <div>{app.contact_name}</div>
                        <div className="text-xs text-muted">{app.email}</div>
                      </td>
                      <td>{app.city}</td>
                      <td><StatusBadge status={app.status} /></td>
                      <td className="text-xs text-muted">{formatWhen(app.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'shops' && (
        <>
          {shopsLoading ? (
            <AdminTableSkeleton rows={5} cols={6} />
          ) : shops.length === 0 ? (
            <p className="text-sm text-muted">No shops yet. Approve an application to create one.</p>
          ) : (
            <div className="admin-panel overflow-x-auto">
              <table className="admin-table w-full min-w-[720px] text-sm">
                <thead>
                  <tr>
                    <th>Shop</th>
                    <th>Contact</th>
                    <th>Commission</th>
                    <th>Status</th>
                    <th>Published</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shops.map((shop) => (
                    <tr key={shop.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          {shop.logo_url ? (
                            <img
                              src={resolveProductImageUrl(shop.logo_url)}
                              alt=""
                              className="h-8 w-8 rounded-lg object-cover"
                            />
                          ) : (
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-green/10 text-xs font-bold text-brand-green">
                              {shop.name.charAt(0)}
                            </span>
                          )}
                          <div>
                            <div className="font-semibold">{shop.name}</div>
                            <Link to={`/stores/${shop.slug}`} className="text-xs font-bold text-brand-green hover:underline" target="_blank">
                              /stores/{shop.slug}
                            </Link>
                          </div>
                        </div>
                      </td>
                      <td className="text-xs">
                        <div>{shop.contact_email}</div>
                        <div className="text-muted">{shop.contact_phone}</div>
                      </td>
                      <td>{shop.commission_percent ?? '—'}%</td>
                      <td><StatusBadge status={shop.status} /></td>
                      <td>{shop.is_published ? 'Yes' : 'No'}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => toggleShopPublished(shop)}>
                            {shop.is_published ? 'Unpublish' : 'Publish'}
                          </button>
                          <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => toggleShopStatus(shop)}>
                            {shop.status === 'active' ? 'Suspend' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'listings' && (
        <>
          {!canReviewListings ? (
            <p className="text-sm text-muted">You do not have permission to review listings.</p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-2">
                {LISTING_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setListingFilter(f.value)}
                    className={listingFilter === f.value ? 'admin-mobile-pill-active' : 'admin-mobile-pill'}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {listingsLoading ? (
                <AdminTableSkeleton rows={5} cols={5} />
              ) : listings.length === 0 ? (
                <p className="text-sm text-muted">No listings in this queue.</p>
              ) : (
                <div className="admin-panel overflow-x-auto">
                  <table className="admin-table w-full min-w-[640px] text-sm">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Shop</th>
                        <th>Price</th>
                        <th>Promo tags</th>
                        <th>Listing</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listings.map((row) => {
                        const tags = listingPromoTags(row);
                        const hasPromo = tags.length > 0 && tags[0] !== 'Hidden by admin' || row.shop_badge_label || row.shop_promo_free_delivery;
                        return (
                        <tr key={row.id}>
                          <td className="font-semibold">{row.name}</td>
                          <td>{row.shop_name}</td>
                          <td>{formatPrice(row.price)}</td>
                          <td className="text-xs">
                            {tags.length ? tags.join(', ') : '—'}
                          </td>
                          <td><StatusBadge status={row.listing_status} /></td>
                          <td>
                            <div className="flex flex-wrap gap-1">
                            {row.listing_status === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  className="btn-primary px-2 py-1 text-xs"
                                  disabled={reviewListing.isPending}
                                  onClick={() => reviewListing.mutateAsync({ id: row.id, action: 'approve' })}
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  className="rounded-lg border border-brand-red px-2 py-1 text-xs font-bold text-brand-red"
                                  disabled={reviewListing.isPending}
                                  onClick={() => reviewListing.mutateAsync({ id: row.id, action: 'reject' })}
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {hasPromo && (
                              <>
                                {row.shop_badge_hidden ? (
                                  <button
                                    type="button"
                                    className="btn-ghost px-2 py-1 text-xs"
                                    disabled={moderateBadge.isPending}
                                    onClick={() => moderateBadge.mutateAsync({ id: row.id, action: 'unhide' })}
                                  >
                                    Show badges
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn-ghost px-2 py-1 text-xs"
                                    disabled={moderateBadge.isPending}
                                    onClick={() => moderateBadge.mutateAsync({ id: row.id, action: 'hide' })}
                                  >
                                    Hide badges
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="rounded-lg border border-brand-red/50 px-2 py-1 text-xs text-brand-red"
                                  disabled={moderateBadge.isPending}
                                  onClick={() => moderateBadge.mutateAsync({ id: row.id, action: 'clear' })}
                                >
                                  Clear tags
                                </button>
                              </>
                            )}
                            </div>
                          </td>
                        </tr>
                      );})}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}

      {tab === 'billing' && canViewBilling && (
        <>
          {billingLoading ? (
            <AdminTableSkeleton rows={4} cols={4} />
          ) : (
            <>
              {canManageFees && (
                <form onSubmit={saveBillingSettings} className="admin-panel mb-6 space-y-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">Shop billing settings</p>
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-brand-green"
                      checked={!!billingSettings.shop_billing_enabled}
                      onChange={(e) => setBillingForm({ ...billingSettings, shop_billing_enabled: e.target.checked })}
                    />
                    <span>
                      <span className="block text-sm font-semibold">Enable shop registration & renewal billing</span>
                      <span className="text-xs text-muted">Applicants pay via Paystack; sellers renew from their dashboard.</span>
                    </span>
                  </label>
                  {billingSettings.shop_billing_enabled && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block text-sm">
                        <span className="mb-1 block font-semibold">Registration fee (GHS)</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="input-field w-full"
                          value={billingSettings.shop_registration_fee_ghs ?? 0}
                          onChange={(e) => setBillingForm({ ...billingSettings, shop_registration_fee_ghs: Number(e.target.value) || 0 })}
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block font-semibold">Renewal fee (GHS)</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="input-field w-full"
                          value={billingSettings.shop_renewal_fee_ghs ?? 0}
                          onChange={(e) => setBillingForm({ ...billingSettings, shop_renewal_fee_ghs: Number(e.target.value) || 0 })}
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block font-semibold">Renewal period</span>
                        <select
                          className="input-field w-full"
                          value={billingSettings.shop_renewal_period || 'yearly'}
                          onChange={(e) => setBillingForm({ ...billingSettings, shop_renewal_period: e.target.value })}
                        >
                          <option value="monthly">Monthly</option>
                          <option value="yearly">Yearly</option>
                        </select>
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block font-semibold">Grace days</span>
                        <input
                          type="number"
                          min="0"
                          className="input-field w-full"
                          value={billingSettings.shop_renewal_grace_days ?? 7}
                          onChange={(e) => setBillingForm({ ...billingSettings, shop_renewal_grace_days: Number(e.target.value) || 0 })}
                        />
                      </label>
                    </div>
                  )}
                  <button type="submit" className="btn-primary px-4 py-2 text-sm" disabled={updateBilling.isPending}>
                    Save billing settings
                  </button>
                </form>
              )}

              {!canManageFees && (
                <div className="admin-panel mb-6 text-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">Current settings</p>
                  <p className="mt-2">
                    Billing {billingSettings.shop_billing_enabled ? 'enabled' : 'disabled'}
                    {billingSettings.shop_billing_enabled && (
                      <>
                        {' '}· Registration {formatPrice(billingSettings.shop_registration_fee_ghs || 0)}
                        {' '}· Renewal {formatPrice(billingSettings.shop_renewal_fee_ghs || 0)} / {billingSettings.shop_renewal_period}
                      </>
                    )}
                  </p>
                </div>
              )}

              <div className="admin-panel mb-6 overflow-x-auto">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">Recent payments</p>
                {billingPayments.length === 0 ? (
                  <p className="text-sm text-muted">No shop billing payments yet.</p>
                ) : (
                  <table className="admin-table w-full min-w-[640px] text-sm">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Shop / application</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Reference</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billingPayments.map((p) => (
                        <tr key={p.id}>
                          <td className="capitalize">{p.payment_type}</td>
                          <td>{p.shop_name || p.application_name || '—'}</td>
                          <td>{formatPrice(p.amount_ghs)}</td>
                          <td><StatusBadge status={p.status} /></td>
                          <td className="font-mono text-xs">{p.paystack_ref}</td>
                          <td className="text-xs text-muted">{formatWhen(p.paid_at || p.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="admin-panel overflow-x-auto">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">Shop subscriptions</p>
                {billingSubscriptions.length === 0 ? (
                  <p className="text-sm text-muted">No subscription records yet.</p>
                ) : (
                  <table className="admin-table w-full min-w-[640px] text-sm">
                    <thead>
                      <tr>
                        <th>Shop</th>
                        <th>Status</th>
                        <th>Period end</th>
                        <th>Waived until</th>
                        {canWaiveFees && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {billingSubscriptions.map((s) => (
                        <tr key={s.shop_id}>
                          <td className="font-semibold">{s.shop_name}</td>
                          <td><StatusBadge status={s.status} /></td>
                          <td>{s.period_end}</td>
                          <td>{s.waived_until || '—'}</td>
                          {canWaiveFees && (
                            <td>
                              <button
                                type="button"
                                className="btn-ghost px-2 py-1 text-xs"
                                disabled={waiveShopRenewal.isPending}
                                onClick={() => waiveShopRenewal.mutateAsync({ shop_id: s.shop_id, note: 'Admin waiver' })}
                              >
                                Waive renewal
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </>
      )}

      {tab === 'withdrawals' && (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            {['requested', 'paid', 'rejected', 'all'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setWithdrawFilter(s)}
                className={withdrawFilter === s ? 'admin-mobile-pill-active' : 'admin-mobile-pill'}
              >
                {s}
                {s === 'requested' && pendingWithdrawals != null && pendingWithdrawals > 0 ? ` (${pendingWithdrawals})` : ''}
              </button>
            ))}
          </div>
          {withdrawalsLoading ? (
            <AdminTableSkeleton rows={5} cols={5} />
          ) : withdrawals.length === 0 ? (
            <p className="text-sm text-muted">No withdrawal requests.</p>
          ) : (
            <div className="admin-panel overflow-x-auto">
              <table className="admin-table w-full min-w-[720px] text-sm">
                <thead>
                  <tr>
                    <th>Shop</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Requested</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((w) => (
                    <tr key={w.id}>
                      <td className="font-semibold">{w.shop_name}</td>
                      <td>{formatPrice(w.amount)}</td>
                      <td className="uppercase">{w.payout_method}</td>
                      <td><StatusBadge status={w.status} /></td>
                      <td className="text-xs text-muted">{formatWhen(w.requested_at)}</td>
                      <td>
                        {w.status === 'requested' && (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className="btn-primary px-2 py-1 text-xs"
                              disabled={processWithdrawal.isPending}
                              onClick={() => processWithdrawal.mutateAsync({ id: w.id, action: 'pay' })}
                            >
                              Mark paid
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-brand-red px-2 py-1 text-xs font-bold text-brand-red"
                              disabled={processWithdrawal.isPending}
                              onClick={() => processWithdrawal.mutateAsync({ id: w.id, action: 'reject' })}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {selectedApp && (
        <ApplicationDetailModal
          app={selectedApp}
          onClose={() => setSelectedApp(null)}
          onApprove={handleApproveApp}
          onReject={handleRejectApp}
          onWaive={handleWaiveApp}
          canWaive={canWaiveFees}
          loading={approveApp.isPending || rejectApp.isPending || waiveAppFee.isPending}
        />
      )}
    </div>
  );
}
