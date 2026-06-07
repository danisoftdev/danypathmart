import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FlashIcon } from '../icons';
import ProductTile from './ProductTile';

function parseEndTime(endsAt) {
  if (!endsAt) return null;
  const normalized = String(endsAt).includes('T') ? endsAt : String(endsAt).replace(' ', 'T');
  const ms = new Date(normalized).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function secondsUntil(endMs) {
  if (!endMs) return 0;
  return Math.max(0, Math.floor((endMs - Date.now()) / 1000));
}

function formatCountdown(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function FlashDealsSection({ products = [], settings }) {
  const endMs = useMemo(() => parseEndTime(settings?.ends_at), [settings?.ends_at]);
  const [seconds, setSeconds] = useState(() => secondsUntil(endMs));

  useEffect(() => {
    setSeconds(secondsUntil(endMs));
    const id = setInterval(() => setSeconds(secondsUntil(endMs)), 1000);
    return () => clearInterval(id);
  }, [endMs]);

  if (settings?.enabled === false) return null;

  const deals = products.filter((p) => p.is_flash_deal).slice(0, 6);
  if (deals.length === 0) return null;

  const title = settings?.title || 'Flash deals';
  const subtitle = settings?.subtitle || 'Limited picks — ends soon';
  const ended = endMs != null && seconds <= 0;

  return (
    <section
      aria-labelledby="flash-deals-heading"
      className="overflow-hidden rounded-2xl border border-brand-gold/30 bg-gradient-to-br from-brand-gold/20 via-[#FFF9F3] to-brand-gold/10 p-4 dark:from-brand-gold/10 dark:via-[#121212] dark:to-brand-gold/5"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gold text-black">
            <FlashIcon />
          </span>
          <div>
            <h2 id="flash-deals-heading" className="text-lg font-extrabold text-[#111111] dark:text-white">
              {title}
            </h2>
            <p className="text-xs text-muted">{subtitle}</p>
          </div>
        </div>
        {endMs != null && (
          <div
            className="rounded-xl bg-[#111111] px-3 py-2 font-mono text-sm font-bold tabular-nums text-brand-gold"
            aria-live="polite"
            aria-label={ended ? 'Flash sale ended' : `Deal ends in ${formatCountdown(seconds)}`}
          >
            {ended ? 'ENDED' : formatCountdown(seconds)}
          </div>
        )}
      </div>

      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 scrollbar-hide">
        {deals.map((p) => (
          <ProductTile key={p.id} product={p} badge={p.badge_label || undefined} />
        ))}
      </div>

      <Link
        to="/shop"
        className="mt-3 inline-block text-sm font-bold text-brand-green hover:underline"
      >
        See all deals &rarr;
      </Link>
    </section>
  );
}
