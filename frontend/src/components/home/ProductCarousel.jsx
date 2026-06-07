import { Link } from 'react-router-dom';
import { ChevronRightIcon } from '../icons';
import ProductTile from './ProductTile';

export default function ProductCarousel({ title, products = [], viewAllTo = '/shop', id }) {
  if (!products.length) return null;

  return (
    <section aria-labelledby={id} className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id={id} className="text-lg font-bold text-[#111111] dark:text-white">
          {title}
        </h2>
        <Link
          to={viewAllTo}
          className="flex min-h-[44px] items-center gap-0.5 text-sm font-bold text-brand-green hover:underline"
        >
          View all
          <ChevronRightIcon className="h-4 w-4" />
        </Link>
      </div>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 scrollbar-hide">
        {products.map((p) => (
          <ProductTile key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
