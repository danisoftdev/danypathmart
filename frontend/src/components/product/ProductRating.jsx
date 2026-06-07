import { productRating } from '../../lib/productUi';

function Star({ filled }) {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0" aria-hidden>
      <path
        d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.5l-4.94 2.6.94-5.5-4-3.9 5.53-.8L10 1.5z"
        fill={filled ? '#F59E0B' : 'none'}
        stroke="#F59E0B"
        strokeWidth="1.2"
      />
    </svg>
  );
}

export default function ProductRating({ product, size = 'sm', showCount = true }) {
  const data = product ? productRating(product) : null;
  if (!data) return null;

  const { rating, reviews } = data;
  const full = Math.floor(rating);
  const textSize = size === 'md' ? 'text-sm' : 'text-xs';

  return (
    <div className={`flex items-center gap-1 ${textSize}`} aria-label={`Rated ${rating} out of 5 from ${reviews} reviews`}>
      <div className="flex">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} filled={i < full} />
        ))}
      </div>
      <span className="font-semibold text-[#111111] dark:text-white">{rating.toFixed(1)}</span>
      {showCount && reviews > 0 && <span className="text-muted">({reviews})</span>}
    </div>
  );
}
