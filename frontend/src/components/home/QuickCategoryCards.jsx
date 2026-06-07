import { Link } from 'react-router-dom';
import { resolveImageUrl } from '../../lib/currency';
import { getCategoryDisplay } from '../../lib/categoryDisplay';

function CategoryAvatar({ category, index }) {
  const src = resolveImageUrl(category.image_url);
  const { tint } = getCategoryDisplay(category, index);
  const letter = (category.name || '?').charAt(0).toUpperCase();

  if (src) {
    return (
      <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-black/5 ring-1 ring-black/10 dark:bg-white/10 dark:ring-white/15 sm:h-16 sm:w-16">
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </span>
    );
  }

  return (
    <span
      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-base font-bold ring-1 ring-black/10 dark:ring-white/15 sm:h-16 sm:w-16 sm:text-lg ${tint}`}
      aria-hidden
    >
      {letter}
    </span>
  );
}

export default function QuickCategoryCards({ categories = [] }) {
  const topLevel = categories.filter((c) => !c.parent_id);

  if (topLevel.length === 0) return null;

  return (
    <section id="quick-categories" aria-labelledby="quick-categories-heading">
      <h2 id="quick-categories-heading" className="mb-4 text-lg font-bold text-[#111111] dark:text-white">
        Shop by category
      </h2>
      <div
        className="-mx-4 flex gap-5 overflow-x-auto px-4 pb-1 scrollbar-hide snap-x snap-mandatory sm:-mx-0 sm:gap-6 sm:px-0"
        role="list"
        aria-label="Product categories"
      >
        {topLevel.map((cat, index) => (
          <Link
            key={cat.id}
            to={`/shop?category=${cat.slug}`}
            role="listitem"
            className="group flex w-[5.5rem] shrink-0 snap-start flex-col items-center gap-2 sm:w-[6.25rem]"
          >
            <CategoryAvatar category={cat} index={index} />
            <span className="line-clamp-2 w-full text-center text-xs font-semibold leading-tight text-[#111111] group-hover:text-brand-green dark:text-white sm:text-sm">
              {cat.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
