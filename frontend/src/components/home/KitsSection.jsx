import { Link } from 'react-router-dom';
import { resolveProductImageUrl } from '../../lib/productImages';

export default function KitsSection({ kits = [] }) {
  if (!kits.length) return null;

  return (
    <section aria-labelledby="member-kits-heading">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="member-kits-heading" className="text-lg font-extrabold text-[#111111] dark:text-white md:text-xl">
            Member kits
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            Everything your member needs — tick what they already have, add the rest.
          </p>
        </div>
        <Link to="/kits" className="text-sm font-bold text-brand-green hover:underline">
          View all kits →
        </Link>
        <Link to="/group-order" className="text-sm font-bold text-muted hover:text-brand-green">
          Group order →
        </Link>
      </div>

      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 scrollbar-hide">
        {kits.slice(0, 8).map((kit) => (
          <Link
            key={kit.id}
            to={`/kits/${kit.slug}`}
            className="flex w-[min(100%,280px)] shrink-0 flex-col overflow-hidden rounded-2xl border border-black/8 bg-white transition hover:border-brand-green/40 hover:shadow-md dark:border-white/10 dark:bg-[#1E1E1E] sm:w-64"
          >
            <div className="aspect-[16/10] bg-brand-green/5 dark:bg-brand-green/10">
              {kit.image_url ? (
                <img
                  src={resolveProductImageUrl(kit.image_url)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-3xl" aria-hidden>
                  🎒
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col p-3">
              <h3 className="line-clamp-2 font-bold leading-snug text-[#111111] dark:text-white">{kit.name}</h3>
              {kit.description && (
                <p className="mt-1 line-clamp-2 text-xs text-muted">{kit.description}</p>
              )}
              <span className="mt-auto pt-2 text-xs font-bold text-brand-green">Build kit →</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
