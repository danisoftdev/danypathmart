import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePlatformFeatures } from '../hooks/checkout';
import ShopLogoField from '../components/shop/ShopLogoField';
import {
  useApplyForShop,
  useConfirmShopBillingDevPayment,
  useInitializeShopRegistrationPayment,
  useShopBillingSettings,
  useShopRegistrationQuote,
  useUploadShopApplicationLogo,
  useValidateShopReferralCode,
} from '../hooks/shop';
import { useAuthStore } from '../store/authStore';
import { formatPrice } from '../lib/currency';

const EMPTY = {
  business_name: '',
  contact_name: '',
  email: '',
  phone: '',
  city: '',
  description: '',
  bank_name: '',
  bank_account_name: '',
  bank_account_number: '',
  momo_number: '',
  logo_url: '',
  referred_by_shop_code: '',
};

export default function ShopApplyPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const refFromUrl = searchParams.get('ref') || '';
  const paymentReturn = searchParams.get('shop_payment') === 'registration';
  const returnAppId = Number(searchParams.get('application_id') || 0);
  const returnRef = searchParams.get('reference') || '';
  const isMockReturn = searchParams.get('mock') === '1';

  const user = useAuthStore((s) => s.user);
  const { marketplaceEnabled, shopApplicationsOpen, shopReferralEnabled, isLoading: flagsLoading } = usePlatformFeatures();
  const apply = useApplyForShop();
  const initPayment = useInitializeShopRegistrationPayment();
  const confirmDev = useConfirmShopBillingDevPayment();
  const uploadLogo = useUploadShopApplicationLogo();
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    contact_name: user?.name || '',
    email: user?.email || '',
    referred_by_shop_code: refFromUrl,
  }));
  const { data: billingSettings } = useShopBillingSettings(marketplaceEnabled);
  const { data: feeQuote } = useShopRegistrationQuote(
    form.email,
    form.referred_by_shop_code,
    marketplaceEnabled && !!billingSettings?.enabled
  );
  const { data: referrerCheck } = useValidateShopReferralCode(
    form.referred_by_shop_code,
    shopReferralEnabled && form.referred_by_shop_code.trim().length >= 2
  );
  const [done, setDone] = useState(false);
  const [pendingPayment, setPendingPayment] = useState(false);
  const [applicationId, setApplicationId] = useState(null);
  const [error, setError] = useState('');
  const [confirmingReturn, setConfirmingReturn] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const listFee = feeQuote?.list_fee ?? billingSettings?.registration_list_fee ?? billingSettings?.registration_fee ?? 0;
  const amountDue = feeQuote?.amount_due ?? billingSettings?.registration_amount_due ?? listFee;
  const requiresPayment = billingSettings?.enabled && amountDue > 0;

  const startPayment = async (appId, email) => {
    const pay = await initPayment.mutateAsync({ application_id: appId, email });
    if (pay.no_payment_needed) {
      setDone(true);
      setPendingPayment(false);
      return;
    }
    if (pay.dev_mock && pay.authorization_url) {
      window.location.href = pay.authorization_url;
      return;
    }
    if (pay.authorization_url) {
      window.location.href = pay.authorization_url;
    }
  };

  useEffect(() => {
    if (!paymentReturn || !returnAppId) return;
    if (isMockReturn && returnRef) return;
    setApplicationId(returnAppId);
    setDone(true);
    setSearchParams({}, { replace: true });
  }, [paymentReturn, returnAppId, isMockReturn, returnRef, setSearchParams]);

  useEffect(() => {
    if (!paymentReturn || !returnAppId || !isMockReturn || !returnRef) return;
    let cancelled = false;
    (async () => {
      setConfirmingReturn(true);
      setError('');
      try {
        await confirmDev.mutateAsync({
          reference: returnRef,
          application_id: returnAppId,
          type: 'registration',
        });
        if (!cancelled) {
          setApplicationId(returnAppId);
          setDone(true);
          setPendingPayment(false);
          setSearchParams({}, { replace: true });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || 'Could not confirm payment.');
        }
      } finally {
        if (!cancelled) setConfirmingReturn(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paymentReturn, returnAppId, isMockReturn, returnRef, confirmDev, setSearchParams]);

  if (!flagsLoading && (!marketplaceEnabled || !shopApplicationsOpen)) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 pb-24 md:py-12">
        <h1 className="text-2xl font-extrabold">Sell on DanyPathMart</h1>
        <p className="mt-3 text-sm text-muted">Shop applications are not open right now.</p>
        <Link to="/" className="mt-4 inline-block text-sm font-bold text-brand-green hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  if (confirmingReturn) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 pb-24 md:py-12">
        <h1 className="text-2xl font-extrabold">Confirming payment…</h1>
        <p className="mt-3 text-sm text-muted">Please wait while we verify your registration fee.</p>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await apply.mutateAsync({
        ...form,
        logo_url: form.logo_url.trim() || undefined,
        referred_by_shop_code: form.referred_by_shop_code.trim() || undefined,
      });
      const app = res.application || {};
      const appId = app.id;
      setApplicationId(appId);

      if (res.requires_payment && appId) {
        setPendingPayment(true);
        await startPayment(appId, form.email);
        return;
      }

      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit application.');
    }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 pb-24 md:py-12">
        <h1 className="text-2xl font-extrabold text-brand-green">Application received</h1>
        <p className="mt-3 text-sm text-muted">
          {paymentReturn || (requiresPayment && !feeQuote?.free_period_active)
            ? 'Your registration fee is paid. We will review your shop application and email you when your seller dashboard is ready.'
            : 'We will review your shop application and email you when your seller dashboard is ready.'}
        </p>
        <Link to="/" className="mt-6 inline-block text-sm font-bold text-brand-green hover:underline">
          Back to store
        </Link>
      </div>
    );
  }

  if (pendingPayment && applicationId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 pb-24 md:py-12">
        <h1 className="text-2xl font-extrabold">Complete registration payment</h1>
        <p className="mt-3 text-sm text-muted">
          Your application was saved. Pay {formatPrice(amountDue)} to submit it for review.
        </p>
        {error && <p className="mt-4 rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red">{error}</p>}
        <button
          type="button"
          className="btn-primary mt-6 min-h-[44px] px-6"
          disabled={initPayment.isPending}
          onClick={() => startPayment(applicationId, form.email)}
        >
          {initPayment.isPending ? 'Starting payment…' : `Pay ${formatPrice(amountDue)}`}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-24 md:py-12">
      <nav className="mb-4 text-sm text-muted">
        <Link to="/" className="hover:text-brand-green">Home</Link>
        {' / '}
        <span>Sell on DanyPathMart</span>
      </nav>

      <h1 className="text-2xl font-extrabold text-[#111111] dark:text-white md:text-3xl">Open your shop</h1>
      <p className="mt-2 text-sm text-muted">
        List uniforms, books, and club materials alongside DanyPathMart. Products go live after admin review.
      </p>

      {billingSettings?.enabled && listFee > 0 && (
        <div className="mt-4 rounded-xl border border-brand-gold/30 bg-brand-gold/10 px-4 py-3 text-sm">
          {feeQuote?.free_period_active ? (
            <p>
              <strong>Free registration</strong> until{' '}
              {billingSettings.free_period_until
                ? new Date(billingSettings.free_period_until).toLocaleDateString()
                : 'promo ends'}
              .
            </p>
          ) : amountDue < listFee ? (
            <p>
              Registration fee:{' '}
              <span className="line-through text-muted">{formatPrice(listFee)}</span>{' '}
              <strong>{formatPrice(amountDue)}</strong>
              {feeQuote?.breakdown?.length > 0 && (
                <span className="mt-1 block text-xs text-muted">
                  {feeQuote.breakdown.map((b) => b.label).join(' · ')}
                </span>
              )}
            </p>
          ) : (
            <p>
              Shop registration fee: <strong>{formatPrice(amountDue)}</strong> (Paystack — card or mobile money).
              You will pay after submitting this form.
            </p>
          )}
        </div>
      )}

      {!user && (
        <p className="mt-4 rounded-xl border border-brand-gold/30 bg-brand-gold/10 px-4 py-3 text-sm">
          Already have an account?{' '}
          <Link to="/login" className="font-bold text-brand-green hover:underline">Sign in</Link>
          {' '}so we can link your shop dashboard to your profile.
        </p>
      )}

      <form onSubmit={submit} className="mt-8 space-y-4 rounded-2xl border border-black/8 bg-white p-5 dark:border-white/10 dark:bg-[#1E1E1E]">
        {error && <p className="rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red">{error}</p>}

        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Business name *</span>
          <input className="input-field w-full" value={form.business_name} onChange={set('business_name')} required />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Contact name *</span>
          <input className="input-field w-full" value={form.contact_name} onChange={set('contact_name')} required />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Email *</span>
            <input type="email" className="input-field w-full" value={form.email} onChange={set('email')} required />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Phone *</span>
            <input className="input-field w-full" value={form.phone} onChange={set('phone')} required />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">City *</span>
          <input className="input-field w-full" value={form.city} onChange={set('city')} required />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">About your shop</span>
          <textarea className="input-field w-full" rows={3} value={form.description} onChange={set('description')} />
        </label>

        <ShopLogoField
          value={form.logo_url}
          onChange={(url) => setForm((f) => ({ ...f, logo_url: url }))}
          uploadFile={(file) => uploadLogo.mutateAsync(file)}
        />

        {shopReferralEnabled && (
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Referred by shop (optional)</span>
            <input
              className="input-field w-full"
              value={form.referred_by_shop_code}
              onChange={set('referred_by_shop_code')}
              placeholder="Shop code or store slug"
            />
            {form.referred_by_shop_code.trim().length >= 2 && referrerCheck?.valid && (
              <p className="mt-1 text-xs font-bold text-brand-green">
                Referred by {referrerCheck.referrer_name || referrerCheck.shop_name}
                {referrerCheck.referrer_type === 'promoter' ? ' (promoter)' : ' (shop)'}
              </p>
            )}
            {form.referred_by_shop_code.trim().length >= 2 && referrerCheck?.valid && referrerCheck?.applicant_discount?.enabled && (
              <p className="mt-1 text-xs text-muted">
                Referral discount:{' '}
                {referrerCheck.applicant_discount.type === 'percent'
                  ? `${referrerCheck.applicant_discount.value}% off registration`
                  : `${formatPrice(referrerCheck.applicant_discount.value)} off registration`}
              </p>
            )}
            {form.referred_by_shop_code.trim().length >= 2 && referrerCheck && !referrerCheck.valid && (
              <p className="mt-1 text-xs text-brand-red">Referral code not found.</p>
            )}
          </label>
        )}

        <div className="rounded-xl border border-black/8 p-4 dark:border-white/10">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Payout details (optional now)</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-semibold">Bank name</span>
              <input className="input-field w-full" value={form.bank_name} onChange={set('bank_name')} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">Account name</span>
              <input className="input-field w-full" value={form.bank_account_name} onChange={set('bank_account_name')} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">Account number</span>
              <input className="input-field w-full" value={form.bank_account_number} onChange={set('bank_account_number')} />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-semibold">Mobile money number</span>
              <input className="input-field w-full" value={form.momo_number} onChange={set('momo_number')} placeholder="233…" />
            </label>
          </div>
        </div>

        <button type="submit" className="btn-primary w-full min-h-[44px]" disabled={apply.isPending || flagsLoading || initPayment.isPending}>
          {apply.isPending || initPayment.isPending
            ? 'Submitting…'
            : requiresPayment
              ? `Submit & pay ${formatPrice(amountDue)}`
              : 'Submit application'}
        </button>
      </form>
    </div>
  );
}
