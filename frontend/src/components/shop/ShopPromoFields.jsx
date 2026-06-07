import { useState } from 'react';
import { shopBadgeOptions } from '../../lib/shopPromo';

export default function ShopPromoFields({ value, onChange }) {
  const presetValues = shopBadgeOptions().map((o) => o.value).filter((v) => v && v !== '__custom__');
  const isPreset = !value.shop_badge_label || presetValues.includes(value.shop_badge_label);
  const [mode, setMode] = useState(isPreset ? value.shop_badge_label || '' : '__custom__');
  const [custom, setCustom] = useState(isPreset ? '' : value.shop_badge_label || '');

  const setLabel = (label) => {
    onChange({ ...value, shop_badge_label: label || '' });
  };

  const onModeChange = (e) => {
    const v = e.target.value;
    setMode(v);
    if (v === '__custom__') {
      setLabel(custom);
    } else {
      setLabel(v);
    }
  };

  return (
    <div className="rounded-xl border border-black/8 p-4 dark:border-white/10">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">Promo tags (optional)</p>
      <p className="mt-1 text-xs text-muted">
        Shown on your product card after listing approval. “Free delivery” is a shop-funded promise for customers.
      </p>

      <label className="mt-3 block text-sm">
        <span className="mb-1 block font-semibold">Badge label</span>
        <select className="input-field w-full" value={mode} onChange={onModeChange}>
          {shopBadgeOptions().map((o) => (
            <option key={o.value || 'none'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {mode === '__custom__' && (
        <label className="mt-2 block text-sm">
          <span className="mb-1 block font-semibold">Custom badge (max 40 chars)</span>
          <input
            className="input-field w-full"
            maxLength={40}
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              setLabel(e.target.value);
            }}
            placeholder="e.g. Bundle deal"
          />
        </label>
      )}

      <label className="mt-3 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-brand-green"
          checked={!!value.shop_promo_free_delivery}
          onChange={(e) => onChange({ ...value, shop_promo_free_delivery: e.target.checked })}
        />
        <span>
          <span className="block text-sm font-semibold">Free delivery</span>
          <span className="text-xs text-muted">You cover local delivery for this item (wording only).</span>
        </span>
      </label>
    </div>
  );
}
