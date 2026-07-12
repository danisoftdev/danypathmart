import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatPrice } from '../../lib/currency';

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const el = document.createElement('textarea');
  el.value = text;
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
  return Promise.resolve();
}

const MODE_HINT = {
  focused: 'Focused link — shop-only view with a soft exit to DanyPathMart.',
  locked: 'Locked link — shop-only, not listed in Browse shops.',
  open: 'Open link — customers can browse other DPM shops from your storefront.',
};

export default function ShopSharePanel({ sharing }) {
  const [copied, setCopied] = useState('');

  const storePath = sharing?.store_url || sharing?.share_url || '';
  const storeUrl = useMemo(() => {
    if (!storePath) return '';
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return `${base}${storePath}`;
  }, [storePath]);

  const applyUrl = useMemo(() => {
    if (!sharing?.referral_code) return '';
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    const path = sharing.referral_apply_url || `/sell?ref=${encodeURIComponent(sharing.referral_code)}`;
    return `${base}${path}`;
  }, [sharing?.referral_code, sharing?.referral_apply_url]);

  if (!sharing) return null;

  const program = sharing.program ?? {};
  const referred = sharing.referred_shops ?? [];
  const mode = sharing.storefront_mode || 'focused';

  const handleCopy = async (label, value) => {
    if (!value) return;
    await copyText(value);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <section className="mt-8 rounded-2xl border border-brand-green/30 bg-brand-green/5 p-5 dark:border-brand-green/40">
      <p className="text-xs font-bold uppercase tracking-wide text-brand-green">Share your shop</p>
      <h2 className="mt-1 text-lg font-extrabold">Customer store link</h2>
      <p className="mt-1 text-xs text-muted">{MODE_HINT[mode] || MODE_HINT.focused}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-black/8 bg-white p-3 dark:border-white/10 dark:bg-[#1E1E1E]">
          <p className="text-xs font-bold uppercase text-muted">Public store link</p>
          <p className="mt-1 truncate text-sm font-mono">{storeUrl || '—'}</p>
          <button
            type="button"
            onClick={() => handleCopy('store', storeUrl)}
            className="btn-primary mt-2 w-full py-2 text-xs"
          >
            {copied === 'store' ? 'Copied!' : 'Copy shop link'}
          </button>
          {storePath && (
            <Link to={storePath} className="mt-2 block text-center text-xs font-bold text-brand-green hover:underline">
              Preview store →
            </Link>
          )}
          <p className="mt-2 text-[11px] text-muted">
            Change privacy in{' '}
            <Link to="/seller/settings" className="font-bold text-brand-green hover:underline">Shop profile</Link>.
          </p>
        </div>

        {program.enabled && (
          <div className="rounded-xl border border-black/8 bg-white p-3 dark:border-white/10 dark:bg-[#1E1E1E]">
            <p className="text-xs font-bold uppercase text-muted">Refer-a-shop code</p>
            <p className="mt-1 text-xl font-extrabold tracking-wide text-brand-green">{sharing.referral_code}</p>
            <p className="mt-1 text-xs text-muted">
              Earn {formatPrice(program.bonus_amount)} when a referred shop completes {program.sales_target} qualifying
              sales ({program.count_on === 'paid' ? 'after payment' : 'after collected'}).
            </p>
            <button
              type="button"
              onClick={() => handleCopy('apply', applyUrl)}
              className="btn-ghost mt-2 w-full border border-brand-green py-2 text-xs font-bold text-brand-green"
            >
              {copied === 'apply' ? 'Copied!' : 'Copy apply link with code'}
            </button>
          </div>
        )}
      </div>

      {program.enabled && referred.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase text-muted">Referred shops</p>
          <ul className="mt-2 divide-y divide-black/5 rounded-xl border border-black/8 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-[#1E1E1E]">
            {referred.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                <div>
                  <p className="font-semibold">{r.referred_shop_name}</p>
                  <Link to={`/stores/${r.referred_shop_slug}`} className="text-xs text-brand-green hover:underline">
                    View store
                  </Link>
                </div>
                <div className="text-right">
                  {r.bonus_paid ? (
                    <span className="text-xs font-bold text-brand-green">Bonus paid</span>
                  ) : (
                    <span className="text-xs font-bold text-muted">
                      {r.qualifying_sales_count} / {r.sales_target} sales
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
