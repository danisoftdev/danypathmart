import { productDisplayBadges } from '../../lib/shopPromo';

/**
 * Stacked promo badges for product cards (top-left).
 */
export default function ProductBadges({ product, labels, className = '' }) {
  const badges = productDisplayBadges(product);
  const showPreorder =
    product?.is_preorder && badges.length === 0 && labels?.badge;

  if (badges.length === 0 && !showPreorder) {
    return null;
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {badges.map((text) => (
        <span
          key={text}
          className="rounded-lg bg-brand-gold px-2 py-0.5 text-[10px] font-bold text-black shadow"
        >
          {text}
        </span>
      ))}
      {showPreorder && (
        <span className="rounded-lg bg-brand-gold px-2 py-0.5 text-[10px] font-bold text-black shadow">
          {labels.badge}
        </span>
      )}
    </div>
  );
}

/**
 * Inline badges for PDP price row.
 */
export function ProductBadgesInline({ product, className = '' }) {
  const badges = productDisplayBadges(product);
  if (!badges.length) return null;

  return (
    <span className={`flex flex-wrap gap-1 ${className}`}>
      {badges.map((text) => (
        <span
          key={text}
          className="rounded-md bg-brand-gold px-2 py-0.5 text-xs font-bold text-black md:text-sm"
        >
          {text}
        </span>
      ))}
    </span>
  );
}
