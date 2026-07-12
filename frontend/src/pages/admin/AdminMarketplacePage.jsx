import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  useAdminShopApplications,
  useAdminShopBilling,
  useAdminShopWithdrawals,
  useAdminPromoterWithdrawals,
  useAdminShops,
  useAdminPromoters,
  useCreatePromoter,
  useUpdatePromoterStatus,
  useApproveShopApplication,
  useMarketplaceListings,
  useProcessShopWithdrawal,
  useProcessPromoterWithdrawal,
  useRejectShopApplication,
  useModerateListingBadge,
  useReviewMarketplaceListing,
  useUpdateAdminShop,
  useDeleteAdminShop,
  useUpdateShopBillingSettings,
  useUpdateShopRegistrationPromo,
  useUpdateReferralRegistrationDiscount,
  useWaiveShopApplicationFee,
  useWaiveShopRenewal,
  useCreateAdminShop,
  usePreapproveShopApplication,
  useCreateShopInvite,
  useShopPolicyAcceptances,
} from '../../hooks/admin';
import { useAuthStore } from '../../store/authStore';
import { hasAnyPermission, hasPermission } from '../../lib/permissions';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminPageAlert from '../../components/admin/AdminPageAlert';
import { AdminTableSkeleton } from '../../components/ui/Skeleton';
import { formatPrice } from '../../lib/currency';
import CopyableText from '../../components/ui/CopyableText';
import { resolveProductImageUrl } from '../../lib/productImages';
import { ShopsMap } from '../StoresPage';

const TABS = [
  { id: 'applications', label: 'Applications', perm: 'ops' },
  { id: 'shops', label: 'Shops', perm: 'ops' },
  { id: 'policy', label: 'Policy acceptances', perm: 'policy' },
  { id: 'map', label: 'Map', perm: 'map' },
  { id: 'promoters', label: 'Promoters', perm: 'ops' },
  { id: 'listings', label: 'Listings', perm: 'ops' },
  { id: 'withdrawals', label: 'Withdrawals', perm: 'ops' },
  { id: 'billing', label: 'Billing', perm: 'billing' },
];

const EMPTY_SHOP_FORM = {
  name: '',
  email: '',
  phone: '',
  customer_service_phone: '',
  city: '',
  owner_user_id: '',
  latitude: '',
  longitude: '',
};

const EMPTY_PREAPPROVE_FORM = {
  business_name: '',
  contact_name: '',
  email: '',
  phone: '',
  customer_service_phone: '',
  city: '',
  owner_user_id: '',
  auto_approve: false,
  admin_note: '',
};

const EMPTY_INVITE_FORM = {
  email: '',
  business_name: '',
  contact_name: '',
  phone: '',
  city: '',
  note: '',
};

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
          {app.customer_service_phone && (
            <div><dt className="text-xs font-bold uppercase text-muted">Customer service</dt><dd>{app.customer_service_phone}</dd></div>
          )}
          <div><dt className="text-xs font-bold uppercase text-muted">City</dt><dd>{app.city}</dd></div>
          {(app.accepted_policies_at || app.accepted_terms) && (
            <div className="rounded-xl border border-black/8 p-3 dark:border-white/10">
              <p className="text-xs font-bold uppercase text-muted">Policy acceptance</p>
              <p className="mt-1 text-sm">
                {app.accepted_terms ? 'Terms' : ''}
                {app.accepted_privacy ? ' · Privacy' : ''}
                {app.accepted_seller_policy ? ' · Seller policy' : ''}
              </p>
              {app.accepted_policies_at && (
                <p className="mt-1 text-xs text-muted">{formatWhen(app.accepted_policies_at)}</p>
              )}
              {app.accepted_policy_slugs && (
                <p className="mt-1 text-xs text-muted">{app.accepted_policy_slugs}</p>
              )}
            </div>
          )}
          {app.source && app.source !== 'public' && (
            <div><dt className="text-xs font-bold uppercase text-muted">Source</dt><dd>{app.source}</dd></div>
          )}
          {app.description && (
            <div><dt className="text-xs font-bold uppercase text-muted">About</dt><dd className="whitespace-pre-wrap">{app.description}</dd></div>
          )}
          {app.referred_by_shop_code && (
            <div>
              <dt className="text-xs font-bold uppercase text-muted">Referred by</dt>
              <dd className="font-semibold">
                {app.referred_by_shop_code}
                {app.referred_by_type ? ` (${app.referred_by_type})` : ''}
              </dd>
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
          {(app.registration_list_fee != null || app.registration_amount_due != null) && (
            <div className="rounded-xl border border-black/8 p-3 dark:border-white/10">
              <p className="text-xs font-bold uppercase text-muted">Registration pricing</p>
              {app.registration_list_fee != null && (
                <p className="mt-1 text-sm">
                  List fee: {formatPrice(app.registration_list_fee)}
                  {(app.registration_discount_amount ?? 0) > 0 && (
                    <> · Discount: −{formatPrice(app.registration_discount_amount)}</>
                  )}
                  {app.registration_amount_due != null && (
                    <> · Due: <strong>{formatPrice(app.registration_amount_due)}</strong></>
                  )}
                </p>
              )}
            </div>
          )}
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
  const canViewBilling = hasAnyPermission(user, [
    'view_shop_billing',
    'manage_shop_fees',
    'manage_shop_registration_promo',
    'manage_referral_registration_discount',
    'waive_shop_fees',
  ]);
  const canManageFees = hasPermission(user, 'manage_shop_fees');
  const canManagePromo = hasPermission(user, 'manage_shop_registration_promo');
  const canManageReferralDiscount = hasPermission(user, 'manage_referral_registration_discount');
  const canWaiveFees = hasPermission(user, 'waive_shop_fees');
  const canOps = hasAnyPermission(user, [
    'manage_marketplace',
    'approve_shop_applications',
    'edit_company_settings',
    'manage_promoters',
    'create_shop_manual',
    'create_shop_preapproved',
    'invite_shop_owner',
    'view_shop_policy_acceptances',
    'view_shops_map',
  ]);
  const canManagePromoters = hasAnyPermission(user, ['manage_promoters', 'edit_company_settings']);
  const canCreateManual = hasPermission(user, 'create_shop_manual');
  const canPreapprove = hasPermission(user, 'create_shop_preapproved');
  const canInvite = hasPermission(user, 'invite_shop_owner');
  const canDeleteShop = hasAnyPermission(user, ['manage_marketplace', 'edit_company_settings']);
  const canViewPolicy = hasAnyPermission(user, ['view_shop_policy_acceptances', 'manage_marketplace']);
  const canViewMap = hasAnyPermission(user, ['view_shops_map', 'manage_marketplace']);
  const canAccess = canOps || canViewBilling;
  const canReviewListings = hasAnyPermission(user, ['manage_marketplace', 'approve_shop_listings', 'add_edit_products']);

  const visibleTabs = TABS.filter((t) => {
    if (t.perm === 'billing') return canViewBilling;
    if (t.perm === 'policy') return canViewPolicy;
    if (t.perm === 'map') return canViewMap;
    return canOps;
  });

  const [tab, setTab] = useState(() => (canOps ? 'applications' : canViewPolicy ? 'policy' : canViewMap ? 'map' : 'billing'));
  const [listingFilter, setListingFilter] = useState('pending');
  const [withdrawFilter, setWithdrawFilter] = useState('requested');
  const [withdrawKind, setWithdrawKind] = useState('shop');
  const [selectedApp, setSelectedApp] = useState(null);
  const [alert, setAlert] = useState('');
  const [alertType, setAlertType] = useState('success');
  const [showCreateShop, setShowCreateShop] = useState(false);
  const [showPreapprove, setShowPreapprove] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [shopForm, setShopForm] = useState(EMPTY_SHOP_FORM);
  const [preapproveForm, setPreapproveForm] = useState(EMPTY_PREAPPROVE_FORM);
  const [inviteForm, setInviteForm] = useState(EMPTY_INVITE_FORM);
  const [inviteResult, setInviteResult] = useState(null);

  const { data: appData, isLoading: appsLoading } = useAdminShopApplications(canAccess && tab === 'applications');
  const { data: shops = [], isLoading: shopsLoading } = useAdminShops(
    canAccess && (tab === 'shops' || tab === 'map')
  );
  const { data: policyApps = [], isLoading: policyLoading } = useShopPolicyAcceptances(
    canAccess && tab === 'policy' && canViewPolicy
  );
  const { data: listings = [], isLoading: listingsLoading } = useMarketplaceListings(
    listingFilter,
    canAccess && tab === 'listings' && canReviewListings
  );
  const { data: withdrawals = [], isLoading: withdrawalsLoading } = useAdminShopWithdrawals(
    withdrawFilter,
    canAccess && tab === 'withdrawals' && withdrawKind === 'shop'
  );
  const { data: promoterWithdrawals = [], isLoading: promoterWithdrawalsLoading } = useAdminPromoterWithdrawals(
    withdrawFilter === 'all' ? '' : withdrawFilter,
    canAccess && tab === 'withdrawals' && withdrawKind === 'promoter' && canManagePromoters
  );
  const { data: promoters = [], isLoading: promotersLoading } = useAdminPromoters(canAccess && tab === 'promoters' && canManagePromoters);
  const createPromoter = useCreatePromoter();
  const updatePromoterStatus = useUpdatePromoterStatus();
  const [promoterForm, setPromoterForm] = useState({ name: '', email: '', password: '', display_name: '', code: '' });

  const approveApp = useApproveShopApplication();
  const rejectApp = useRejectShopApplication();
  const updateShop = useUpdateAdminShop();
  const deleteShop = useDeleteAdminShop();
  const createShop = useCreateAdminShop();
  const preapproveApp = usePreapproveShopApplication();
  const createInvite = useCreateShopInvite();
  const reviewListing = useReviewMarketplaceListing();
  const moderateBadge = useModerateListingBadge();
  const processWithdrawal = useProcessShopWithdrawal();
  const processPromoterWithdrawal = useProcessPromoterWithdrawal();
  const { data: billingData, isLoading: billingLoading } = useAdminShopBilling(canAccess && tab === 'billing' && canViewBilling);
  const updateBilling = useUpdateShopBillingSettings();
  const updatePromo = useUpdateShopRegistrationPromo();
  const updateReferralDiscount = useUpdateReferralRegistrationDiscount();
  const waiveAppFee = useWaiveShopApplicationFee();
  const waiveShopRenewal = useWaiveShopRenewal();
  const [billingForm, setBillingForm] = useState(null);
  const [promoForm, setPromoForm] = useState(null);
  const [referralDiscountForm, setReferralDiscountForm] = useState(null);

  const applications = appData?.data ?? [];
  const newCount = appData?.new_count ?? 0;

  const pendingWithdrawals = useMemo(() => {
    if (withdrawFilter !== 'requested') return null;
    return withdrawKind === 'promoter' ? promoterWithdrawals.length : withdrawals.length;
  }, [withdrawFilter, withdrawKind, withdrawals.length, promoterWithdrawals.length]);

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
  const promoSettings = promoForm ?? billingData?.settings ?? {};
  const referralDiscountSettings = referralDiscountForm ?? billingData?.settings ?? {};
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

  const savePromoSettings = async (e) => {
    e.preventDefault();
    if (!canManagePromo) return;
    try {
      await updatePromo.mutateAsync(promoSettings);
      showAlert('Registration promo settings saved.');
      setPromoForm(null);
    } catch (err) {
      showAlert(err.response?.data?.message || 'Could not save promo settings.', 'error');
    }
  };

  const saveReferralDiscountSettings = async (e) => {
    e.preventDefault();
    if (!canManageReferralDiscount) return;
    try {
      await updateReferralDiscount.mutateAsync(referralDiscountSettings);
      showAlert('Referral applicant discount saved.');
      setReferralDiscountForm(null);
    } catch (err) {
      showAlert(err.response?.data?.message || 'Could not save referral discount.', 'error');
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

  const handleDeleteShop = async (shop) => {
    const ok = window.confirm(
      `Delete "${shop.name}" permanently?\n\nThis removes the shop dashboard, members, and storefront. Products are unlinked (not sold as that shop anymore). Billing history is kept without the shop link.\n\nThis cannot be undone.`
    );
    if (!ok) return;
    const typed = window.prompt(`Type the shop name exactly to confirm:\n${shop.name}`);
    if (typed == null) return;
    try {
      await deleteShop.mutateAsync({ id: shop.id, confirm_name: typed.trim() });
      showAlert(`Shop "${shop.name}" deleted.`);
    } catch (e) {
      showAlert(e.response?.data?.message || 'Could not delete shop.', 'error');
    }
  };

  const handleCreateShop = async (e) => {
    e.preventDefault();
    try {
      await createShop.mutateAsync({
        name: shopForm.name,
        contact_email: shopForm.email,
        contact_phone: shopForm.phone || undefined,
        customer_service_phone: shopForm.customer_service_phone || undefined,
        city: shopForm.city,
        owner_user_id: shopForm.owner_user_id ? Number(shopForm.owner_user_id) : undefined,
        latitude: shopForm.latitude !== '' ? Number(shopForm.latitude) : undefined,
        longitude: shopForm.longitude !== '' ? Number(shopForm.longitude) : undefined,
        status: 'active',
        is_published: true,
      });
      showAlert('Shop created.');
      setShowCreateShop(false);
      setShopForm(EMPTY_SHOP_FORM);
    } catch (err) {
      showAlert(err.response?.data?.message || 'Could not create shop.', 'error');
    }
  };

  const handlePreapprove = async (e) => {
    e.preventDefault();
    try {
      const res = await preapproveApp.mutateAsync({
        business_name: preapproveForm.business_name,
        contact_name: preapproveForm.contact_name,
        email: preapproveForm.email,
        phone: preapproveForm.phone,
        customer_service_phone: preapproveForm.customer_service_phone || preapproveForm.phone,
        city: preapproveForm.city,
        owner_user_id: preapproveForm.owner_user_id ? Number(preapproveForm.owner_user_id) : undefined,
        auto_approve: preapproveForm.auto_approve,
        admin_note: preapproveForm.admin_note || undefined,
      });
      showAlert(res.shop ? 'Pre-approved and shop created.' : 'Pre-approved application created.');
      setShowPreapprove(false);
      setPreapproveForm(EMPTY_PREAPPROVE_FORM);
    } catch (err) {
      showAlert(err.response?.data?.message || 'Could not create pre-approved application.', 'error');
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    try {
      const res = await createInvite.mutateAsync(inviteForm);
      setInviteResult(res.invite_url || res.invite?.invite_url || res.invite_path || res.invite?.invite_path || null);
      showAlert('Invite created and sent with the invite link.');
      setInviteForm(EMPTY_INVITE_FORM);
    } catch (err) {
      showAlert(err.response?.data?.message || 'Could not create invite.', 'error');
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
          {(canCreateManual || canPreapprove || canInvite) && (
            <div className="mb-4 flex flex-wrap gap-2">
              {canCreateManual && (
                <button type="button" className="btn-primary px-3 py-2 text-sm" onClick={() => setShowCreateShop(true)}>
                  Create shop
                </button>
              )}
              {canPreapprove && (
                <button
                  type="button"
                  className="rounded-xl border border-brand-green px-3 py-2 text-sm font-bold text-brand-green"
                  onClick={() => setShowPreapprove(true)}
                >
                  Create pre-approved application
                </button>
              )}
              {canInvite && (
                <button
                  type="button"
                  className="rounded-xl border border-brand-gold px-3 py-2 text-sm font-bold text-brand-gold"
                  onClick={() => { setInviteResult(null); setShowInvite(true); }}
                >
                  Invite shop owner
                </button>
              )}
            </div>
          )}
          {shopsLoading ? (
            <AdminTableSkeleton rows={5} cols={6} />
          ) : shops.length === 0 ? (
            <p className="text-sm text-muted">No shops yet. Approve an application or create one above.</p>
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
                        {shop.customer_service_phone && (
                          <div className="text-muted">CS: {shop.customer_service_phone}</div>
                        )}
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
                          {canDeleteShop && (
                            <button
                              type="button"
                              className="px-2 py-1 text-xs font-bold text-brand-red hover:underline disabled:opacity-50"
                              disabled={deleteShop.isPending}
                              onClick={() => handleDeleteShop(shop)}
                            >
                              Delete
                            </button>
                          )}
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

      {tab === 'policy' && (
        <>
          {!canViewPolicy ? (
            <p className="text-sm text-muted">You do not have permission to view policy acceptances.</p>
          ) : policyLoading ? (
            <AdminTableSkeleton rows={5} cols={5} />
          ) : policyApps.length === 0 ? (
            <p className="text-sm text-muted">No policy acceptances recorded yet.</p>
          ) : (
            <div className="admin-panel overflow-x-auto">
              <table className="admin-table w-full min-w-[720px] text-sm">
                <thead>
                  <tr>
                    <th>Business</th>
                    <th>Contact</th>
                    <th>Accepted</th>
                    <th>Slugs</th>
                    <th>When</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {policyApps.map((app) => (
                    <tr key={app.id} className="cursor-pointer hover:bg-black/3 dark:hover:bg-white/5" onClick={() => setSelectedApp(app)}>
                      <td className="font-semibold">{app.business_name}</td>
                      <td>
                        <div>{app.contact_name}</div>
                        <div className="text-xs text-muted">{app.email}</div>
                      </td>
                      <td className="text-xs">
                        {[
                          app.accepted_terms && 'Terms',
                          app.accepted_privacy && 'Privacy',
                          app.accepted_seller_policy && 'Seller',
                        ].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="text-xs text-muted">{app.accepted_policy_slugs || '—'}</td>
                      <td className="text-xs text-muted">{formatWhen(app.accepted_policies_at || app.created_at)}</td>
                      <td className="text-xs text-muted">{app.policies_accepted_ip || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'map' && (
        <>
          {!canViewMap ? (
            <p className="text-sm text-muted">You do not have permission to view the shops map.</p>
          ) : shopsLoading ? (
            <AdminTableSkeleton rows={3} cols={3} />
          ) : (
            <ShopsMap shops={shops} />
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

      {tab === 'promoters' && canManagePromoters && (
        <>
          <form
            className="admin-panel mb-6 grid gap-3 md:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setAlert('');
              try {
                await createPromoter.mutateAsync(promoterForm);
                setPromoterForm({ name: '', email: '', password: '', display_name: '', code: '' });
                setAlert('Promoter created.');
                setAlertType('success');
              } catch (err) {
                setAlert(err.response?.data?.message || 'Could not create promoter.');
                setAlertType('error');
              }
            }}
          >
            <h3 className="md:col-span-2 text-sm font-bold uppercase text-muted">Add promoter</h3>
            <input className="input-field" placeholder="Display name" value={promoterForm.display_name} onChange={(e) => setPromoterForm((f) => ({ ...f, display_name: e.target.value, name: e.target.value }))} required />
            <input className="input-field" placeholder="Email" type="email" value={promoterForm.email} onChange={(e) => setPromoterForm((f) => ({ ...f, email: e.target.value }))} required />
            <input className="input-field" placeholder="Password (8+)" type="password" value={promoterForm.password} onChange={(e) => setPromoterForm((f) => ({ ...f, password: e.target.value }))} required />
            <input className="input-field" placeholder="Code (optional)" value={promoterForm.code} onChange={(e) => setPromoterForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} />
            <button type="submit" className="btn-primary px-4 py-2 text-sm md:col-span-2" disabled={createPromoter.isPending}>Create promoter</button>
          </form>
          {promotersLoading ? (
            <AdminTableSkeleton rows={4} cols={4} />
          ) : (
            <div className="admin-panel overflow-x-auto">
              <table className="admin-table w-full text-sm">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Code</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {promoters.map((p) => (
                    <tr key={p.id}>
                      <td>{p.display_name}</td>
                      <td><CopyableText value={p.code} /></td>
                      <td>{p.email}</td>
                      <td><StatusBadge status={p.status} /></td>
                      <td>
                        {p.status !== 'active' && (
                          <button type="button" className="text-xs font-bold text-brand-green" onClick={() => updatePromoterStatus.mutateAsync({ id: p.id, status: 'active' })}>Activate</button>
                        )}
                        {p.status === 'active' && (
                          <button type="button" className="text-xs font-bold text-brand-red" onClick={() => updatePromoterStatus.mutateAsync({ id: p.id, status: 'suspended' })}>Suspend</button>
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
                        <span className="mt-1 block text-xs text-muted">0 = free registration</span>
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block font-semibold">Monthly renewal (GHS)</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="input-field w-full"
                          value={billingSettings.shop_renewal_fee_monthly_ghs ?? 0}
                          onChange={(e) => setBillingForm({ ...billingSettings, shop_renewal_fee_monthly_ghs: Number(e.target.value) || 0 })}
                        />
                        <span className="mt-1 block text-xs text-muted">0 = monthly plan off</span>
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block font-semibold">Yearly renewal (GHS)</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="input-field w-full"
                          value={billingSettings.shop_renewal_fee_yearly_ghs ?? 0}
                          onChange={(e) => setBillingForm({ ...billingSettings, shop_renewal_fee_yearly_ghs: Number(e.target.value) || 0 })}
                        />
                        <span className="mt-1 block text-xs text-muted">0 = yearly plan off</span>
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block font-semibold">Default plan preference</span>
                        <select
                          className="input-field w-full"
                          value={billingSettings.shop_renewal_period || 'yearly'}
                          onChange={(e) => setBillingForm({ ...billingSettings, shop_renewal_period: e.target.value })}
                        >
                          <option value="monthly">Prefer monthly</option>
                          <option value="yearly">Prefer yearly</option>
                        </select>
                      </label>
                      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-black/8 p-3 text-sm dark:border-white/10 sm:col-span-2">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 accent-brand-green"
                          checked={!!billingSettings.shop_new_shop_free_month_enabled}
                          onChange={(e) =>
                            setBillingForm({
                              ...billingSettings,
                              shop_new_shop_free_month_enabled: e.target.checked,
                            })
                          }
                        />
                        <span>
                          <span className="block font-semibold">Free first month for new shops</span>
                          <span className="mt-0.5 block text-xs text-muted">
                            No payment at apply time. First subscription month is free after approval. Untick to charge as usual.
                          </span>
                        </span>
                      </label>
                      <label className="block text-sm sm:col-span-2">
                        <span className="mb-1 block font-semibold">Paystack fee handling</span>
                        <select
                          className="input-field w-full"
                          value={billingSettings.paystack_fee_mode || 'absorb'}
                          onChange={(e) =>
                            setBillingForm({ ...billingSettings, paystack_fee_mode: e.target.value })
                          }
                        >
                          <option value="absorb">Absorb fees (seller pays listed fee only)</option>
                          <option value="pass_to_payer">Pass fees to seller (add estimate on top)</option>
                        </select>
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block font-semibold">Paystack fee %</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="input-field w-full"
                          value={billingSettings.paystack_fee_percent ?? 1.95}
                          onChange={(e) =>
                            setBillingForm({
                              ...billingSettings,
                              paystack_fee_percent: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block font-semibold">Paystack flat fee (GHS)</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="input-field w-full"
                          value={billingSettings.paystack_fee_flat_ghs ?? 0}
                          onChange={(e) =>
                            setBillingForm({
                              ...billingSettings,
                              paystack_fee_flat_ghs: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </label>
                      <label className="block text-sm sm:col-span-2">
                        <span className="mb-1 block font-semibold">Fee note (shown on receipts)</span>
                        <input
                          type="text"
                          className="input-field w-full"
                          value={billingSettings.paystack_fee_note || ''}
                          onChange={(e) =>
                            setBillingForm({ ...billingSettings, paystack_fee_note: e.target.value })
                          }
                          placeholder="e.g. Processor fees may vary slightly by channel"
                        />
                      </label>
                    </div>
                  )}
                  <button type="submit" className="btn-primary px-4 py-2 text-sm" disabled={updateBilling.isPending}>
                    Save billing settings
                  </button>
                </form>
              )}

              {canManagePromo && (
                <form onSubmit={savePromoSettings} className="admin-panel mb-6 space-y-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">Registration promos</p>
                  <p className="text-xs text-muted">
                    Requires <strong>manage_shop_registration_promo</strong>. Set a free-registration window or a first-time seller discount.
                  </p>
                  <label className="block text-sm">
                    <span className="mb-1 block font-semibold">Free registration until (optional)</span>
                    <input
                      type="date"
                      className="input-field w-full max-w-xs"
                      value={promoSettings.shop_registration_free_until || ''}
                      onChange={(e) =>
                        setPromoForm({
                          ...promoSettings,
                          shop_registration_free_until: e.target.value || null,
                        })
                      }
                    />
                    <span className="mt-1 block text-xs text-muted">Leave empty when not running a free signup promo.</span>
                  </label>
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-brand-green"
                      checked={!!promoSettings.shop_first_reg_discount_enabled}
                      onChange={(e) =>
                        setPromoForm({ ...promoSettings, shop_first_reg_discount_enabled: e.target.checked })
                      }
                    />
                    <span>
                      <span className="block text-sm font-semibold">First registration discount</span>
                      <span className="text-xs text-muted">For applicants with no prior approved shop on DPM.</span>
                    </span>
                  </label>
                  {promoSettings.shop_first_reg_discount_enabled && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block text-sm">
                        <span className="mb-1 block font-semibold">Discount type</span>
                        <select
                          className="input-field w-full"
                          value={promoSettings.shop_first_reg_discount_type || 'fixed'}
                          onChange={(e) =>
                            setPromoForm({ ...promoSettings, shop_first_reg_discount_type: e.target.value })
                          }
                        >
                          <option value="fixed">Fixed amount (GHS off)</option>
                          <option value="percent">Percent off</option>
                        </select>
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block font-semibold">Discount value</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="input-field w-full"
                          value={promoSettings.shop_first_reg_discount_value ?? 0}
                          onChange={(e) =>
                            setPromoForm({
                              ...promoSettings,
                              shop_first_reg_discount_value: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </label>
                    </div>
                  )}
                  <button type="submit" className="btn-primary px-4 py-2 text-sm" disabled={updatePromo.isPending}>
                    Save promo settings
                  </button>
                </form>
              )}

              {canManageReferralDiscount && (
                <form onSubmit={saveReferralDiscountSettings} className="admin-panel mb-6 space-y-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">Referral applicant discount</p>
                  <p className="text-xs text-muted">
                    Requires <strong>manage_referral_registration_discount</strong>. Discount for new sellers who apply with a valid shop or promoter code.
                    Promoter commission on the paid amount is unchanged.
                  </p>
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-brand-green"
                      checked={!!referralDiscountSettings.shop_referral_reg_discount_enabled}
                      onChange={(e) =>
                        setReferralDiscountForm({
                          ...referralDiscountSettings,
                          shop_referral_reg_discount_enabled: e.target.checked,
                        })
                      }
                    />
                    <span className="block text-sm font-semibold">Enable referral code discount for applicants</span>
                  </label>
                  {referralDiscountSettings.shop_referral_reg_discount_enabled && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block text-sm">
                        <span className="mb-1 block font-semibold">Discount type</span>
                        <select
                          className="input-field w-full"
                          value={referralDiscountSettings.shop_referral_reg_discount_type || 'percent'}
                          onChange={(e) =>
                            setReferralDiscountForm({
                              ...referralDiscountSettings,
                              shop_referral_reg_discount_type: e.target.value,
                            })
                          }
                        >
                          <option value="percent">Percent off</option>
                          <option value="fixed">Fixed amount (GHS off)</option>
                        </select>
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block font-semibold">Discount value</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="input-field w-full"
                          value={referralDiscountSettings.shop_referral_reg_discount_value ?? 10}
                          onChange={(e) =>
                            setReferralDiscountForm({
                              ...referralDiscountSettings,
                              shop_referral_reg_discount_value: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </label>
                    </div>
                  )}
                  <button type="submit" className="btn-primary px-4 py-2 text-sm" disabled={updateReferralDiscount.isPending}>
                    Save referral discount
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
                        {billingSettings.shop_registration_free_until && (
                          <> · Free until {billingSettings.shop_registration_free_until}</>
                        )}
                        {billingSettings.shop_first_reg_discount_enabled && (
                          <> · First-reg discount on</>
                        )}
                        {billingSettings.shop_referral_reg_discount_enabled && (
                          <> · Referral applicant discount on</>
                        )}
                        {' '}· Monthly {formatPrice(billingSettings.shop_renewal_fee_monthly_ghs || 0)}
                        {' · '}Yearly {formatPrice(billingSettings.shop_renewal_fee_yearly_ghs || 0)}
                        {' '}(default {billingSettings.shop_renewal_period})
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
            <button
              type="button"
              onClick={() => setWithdrawKind('shop')}
              className={withdrawKind === 'shop' ? 'admin-mobile-pill-active' : 'admin-mobile-pill'}
            >
              Shop payouts
            </button>
            {canManagePromoters && (
              <button
                type="button"
                onClick={() => setWithdrawKind('promoter')}
                className={withdrawKind === 'promoter' ? 'admin-mobile-pill-active' : 'admin-mobile-pill'}
              >
                Promoter payouts
              </button>
            )}
          </div>
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
          {withdrawKind === 'shop' && (
            withdrawalsLoading ? (
              <AdminTableSkeleton rows={5} cols={5} />
            ) : withdrawals.length === 0 ? (
              <p className="text-sm text-muted">No shop withdrawal requests.</p>
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
            )
          )}
          {withdrawKind === 'promoter' && canManagePromoters && (
            promoterWithdrawalsLoading ? (
              <AdminTableSkeleton rows={5} cols={5} />
            ) : promoterWithdrawals.length === 0 ? (
              <p className="text-sm text-muted">No promoter withdrawal requests.</p>
            ) : (
              <div className="admin-panel overflow-x-auto">
                <table className="admin-table w-full min-w-[720px] text-sm">
                  <thead>
                    <tr>
                      <th>Promoter</th>
                      <th>Code</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Status</th>
                      <th>Requested</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {promoterWithdrawals.map((w) => (
                      <tr key={w.id}>
                        <td className="font-semibold">{w.promoter_name}</td>
                        <td className="font-mono text-xs">{w.promoter_code}</td>
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
                                disabled={processPromoterWithdrawal.isPending}
                                onClick={() => processPromoterWithdrawal.mutateAsync({ id: w.id, action: 'pay' })}
                              >
                                Mark paid
                              </button>
                              <button
                                type="button"
                                className="rounded-lg border border-brand-red px-2 py-1 text-xs font-bold text-brand-red"
                                disabled={processPromoterWithdrawal.isPending}
                                onClick={() => processPromoterWithdrawal.mutateAsync({ id: w.id, action: 'reject' })}
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
            )
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

      {showCreateShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !createShop.isPending && setShowCreateShop(false)}>
          <form
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 dark:bg-[#1E1E1E]"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreateShop}
          >
            <h3 className="text-lg font-extrabold">Create shop</h3>
            <p className="mt-1 text-xs text-muted">Direct create — requires create_shop_manual.</p>
            <div className="mt-4 space-y-3">
              {[
                ['name', 'Shop name *', true],
                ['email', 'Email *', true],
                ['phone', 'Phone', false],
                ['customer_service_phone', 'Customer service / WhatsApp', false],
                ['city', 'City *', true],
                ['owner_user_id', 'Owner user ID (optional)', false],
                ['latitude', 'Latitude (optional)', false],
                ['longitude', 'Longitude (optional)', false],
              ].map(([key, label, required]) => (
                <label key={key} className="block text-sm">
                  <span className="mb-1 block font-semibold">{label}</span>
                  <input
                    className="input-field w-full"
                    type={key === 'email' ? 'email' : 'text'}
                    value={shopForm[key]}
                    onChange={(e) => setShopForm((f) => ({ ...f, [key]: e.target.value }))}
                    required={required}
                  />
                </label>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button type="submit" className="btn-primary px-4 py-2 text-sm" disabled={createShop.isPending}>
                {createShop.isPending ? 'Creating…' : 'Create'}
              </button>
              <button type="button" className="btn-ghost px-4 py-2 text-sm" onClick={() => setShowCreateShop(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {showPreapprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !preapproveApp.isPending && setShowPreapprove(false)}>
          <form
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 dark:bg-[#1E1E1E]"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handlePreapprove}
          >
            <h3 className="text-lg font-extrabold">Create pre-approved application</h3>
            <p className="mt-1 text-xs text-muted">Policy acceptance will be recorded as admin-attested.</p>
            <div className="mt-4 space-y-3">
              {[
                ['business_name', 'Business name *', true],
                ['contact_name', 'Contact name *', true],
                ['email', 'Email *', true],
                ['phone', 'Phone *', true],
                ['customer_service_phone', 'Customer service / WhatsApp', false],
                ['city', 'City *', true],
                ['owner_user_id', 'Owner user ID (optional)', false],
              ].map(([key, label, required]) => (
                <label key={key} className="block text-sm">
                  <span className="mb-1 block font-semibold">{label}</span>
                  <input
                    className="input-field w-full"
                    type={key === 'email' ? 'email' : 'text'}
                    value={preapproveForm[key]}
                    onChange={(e) => setPreapproveForm((f) => ({ ...f, [key]: e.target.value }))}
                    required={required}
                  />
                </label>
              ))}
              <label className="block text-sm">
                <span className="mb-1 block font-semibold">Admin note</span>
                <textarea
                  className="input-field w-full"
                  rows={2}
                  value={preapproveForm.admin_note}
                  onChange={(e) => setPreapproveForm((f) => ({ ...f, admin_note: e.target.value }))}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={preapproveForm.auto_approve}
                  onChange={(e) => setPreapproveForm((f) => ({ ...f, auto_approve: e.target.checked }))}
                />
                Also approve & create shop now
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="submit" className="btn-primary px-4 py-2 text-sm" disabled={preapproveApp.isPending}>
                {preapproveApp.isPending ? 'Saving…' : 'Create'}
              </button>
              <button type="button" className="btn-ghost px-4 py-2 text-sm" onClick={() => setShowPreapprove(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !createInvite.isPending && setShowInvite(false)}>
          <form
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 dark:bg-[#1E1E1E]"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleInvite}
          >
            <h3 className="text-lg font-extrabold">Invite shop owner</h3>
            <p className="mt-1 text-xs text-muted">Sends a 14-day invite email (and in-app / SMS / WhatsApp when available) with the registration link.</p>
            {inviteResult && (
              <p className="mt-3 rounded-xl bg-brand-green/10 px-3 py-2 text-sm">
                Invite link: <CopyableText value={inviteResult} className="font-bold text-brand-green" />
              </p>
            )}
            <div className="mt-4 space-y-3">
              {[
                ['email', 'Email *', true],
                ['business_name', 'Business name', false],
                ['contact_name', 'Contact name', false],
                ['phone', 'Phone', false],
                ['city', 'City', false],
              ].map(([key, label, required]) => (
                <label key={key} className="block text-sm">
                  <span className="mb-1 block font-semibold">{label}</span>
                  <input
                    className="input-field w-full"
                    type={key === 'email' ? 'email' : 'text'}
                    value={inviteForm[key]}
                    onChange={(e) => setInviteForm((f) => ({ ...f, [key]: e.target.value }))}
                    required={required}
                  />
                </label>
              ))}
              <label className="block text-sm">
                <span className="mb-1 block font-semibold">Note</span>
                <textarea
                  className="input-field w-full"
                  rows={2}
                  value={inviteForm.note}
                  onChange={(e) => setInviteForm((f) => ({ ...f, note: e.target.value }))}
                />
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="submit" className="btn-primary px-4 py-2 text-sm" disabled={createInvite.isPending}>
                {createInvite.isPending ? 'Creating…' : 'Create invite'}
              </button>
              <button type="button" className="btn-ghost px-4 py-2 text-sm" onClick={() => setShowInvite(false)}>
                Close
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
