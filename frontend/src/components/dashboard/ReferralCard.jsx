import { useMemo, useState } from 'react';
import { formatPrice } from '../../lib/currency';
import { useReferralInfo } from '../../hooks/loyalty';

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

export default function ReferralCard() {
  const { data, isLoading } = useReferralInfo();
  const [copied, setCopied] = useState('');

  const shareLink = useMemo(() => {
    if (!data?.code) return '';
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return `${base}/group-order?ref=${encodeURIComponent(data.code)}`;
  }, [data?.code]);

  if (isLoading || !data?.enabled) {
    return null;
  }

  const handleCopy = async (label, value) => {
    if (!value) return;
    await copyText(value);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div className="mb-8 rounded-2xl border border-brand-green/30 bg-brand-green/5 p-5 dark:border-brand-green/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brand-green">Refer a club leader</p>
          <h2 className="mt-1 text-lg font-extrabold">Share your link, earn wallet credit</h2>
          <p className="mt-1 text-sm text-muted">
            When a new club completes their first paid order with your code, you receive{' '}
            <span className="font-bold text-brand-green">{formatPrice(data.credit_amount)}</span> in your wallet.
          </p>
        </div>
        {data.referrals > 0 && (
          <span className="rounded-full bg-brand-green/15 px-3 py-1 text-xs font-bold text-brand-green">
            {data.referrals} referral{data.referrals === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-black/8 bg-white p-3 dark:border-white/10 dark:bg-[#1E1E1E]">
          <p className="text-xs font-bold uppercase text-muted">Your code</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="font-mono text-lg font-extrabold">{data.code}</span>
            <button
              type="button"
              onClick={() => handleCopy('code', data.code)}
              className="rounded-lg bg-brand-green/10 px-3 py-1.5 text-xs font-bold text-brand-green"
            >
              {copied === 'code' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
        <div className="rounded-xl border border-black/8 bg-white p-3 dark:border-white/10 dark:bg-[#1E1E1E]">
          <p className="text-xs font-bold uppercase text-muted">Share link</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold">{shareLink}</span>
            <button
              type="button"
              onClick={() => handleCopy('link', shareLink)}
              className="shrink-0 rounded-lg bg-brand-green/10 px-3 py-1.5 text-xs font-bold text-brand-green"
            >
              {copied === 'link' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
