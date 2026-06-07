import { useCallback, useEffect, useRef, useState } from 'react';
import ProductImage from './ProductImage';
import { CloseIcon } from '../icons';

function Thumbnail({ src, alt, active, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="View product image"
      aria-current={active ? 'true' : undefined}
      className={`shrink-0 overflow-hidden rounded-md border bg-white transition dark:bg-[#252525] ${
        active ? 'border-brand-green ring-1 ring-brand-green/30' : 'border-black/10 opacity-75 hover:opacity-100 dark:border-white/15'
      } ${className}`}
    >
      <ProductImage src={src} alt={alt} fit="cover" className="h-full w-full" />
    </button>
  );
}

/** Main image height — capped so photos never dominate the page. */
const MAIN_H = {
  compact: 'h-[200px]',
  mobile: 'h-[240px] sm:h-[280px]',
  desktop: 'md:h-[300px] lg:h-[320px]',
};

export default function ProductGallery({ images = [], alt, compact = false }) {
  const [active, setActive] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const touchStart = useRef(null);
  const list = images.length ? images : [null];

  const go = useCallback(
    (dir) => {
      setActive((i) => (i + dir + list.length) % list.length);
    },
    [list.length]
  );

  const onTouchStart = (e) => {
    touchStart.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e) => {
    if (touchStart.current == null) return;
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) go(diff > 0 ? 1 : -1);
    touchStart.current = null;
  };

  useEffect(() => {
    if (!zoomOpen) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') setZoomOpen(false);
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomOpen, go]);

  const mainHeight = compact
    ? MAIN_H.compact
    : `${MAIN_H.mobile} ${MAIN_H.desktop}`;

  const mainImage = (
    <div
      className={`relative w-full ${mainHeight} cursor-zoom-in overflow-hidden rounded-xl border border-black/8 bg-[#fafafa] dark:border-white/10 dark:bg-[#252525]`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onClick={() => setZoomOpen(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setZoomOpen(true);
        }
        if (e.key === 'ArrowLeft') go(-1);
        if (e.key === 'ArrowRight') go(1);
      }}
      aria-label="Product image — click to enlarge"
    >
      <ProductImage
        src={list[active]}
        alt={alt}
        fit="contain"
        priority={active === 0}
        className="h-full w-full p-1.5 sm:p-2"
      />

      {list.length > 1 && (
        <span className="absolute bottom-2 right-2 rounded bg-black/50 px-2 py-0.5 text-[11px] font-medium text-white">
          {active + 1}/{list.length}
        </span>
      )}

      {list.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            className="absolute left-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-base shadow dark:bg-black/70 dark:text-white"
            aria-label="Previous image"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-base shadow dark:bg-black/70 dark:text-white"
            aria-label="Next image"
          >
            ›
          </button>
        </>
      )}
    </div>
  );

  return (
    <>
      <div className="flex flex-col md:flex-row md:gap-2.5">
        {list.length > 1 && (
          <div className="order-2 hidden max-h-[320px] w-12 shrink-0 flex-col gap-1.5 overflow-y-auto scrollbar-hide md:order-1 md:flex">
            {list.map((img, i) => (
              <Thumbnail
                key={i}
                src={img}
                alt={`${alt} ${i + 1}`}
                active={active === i}
                onClick={() => setActive(i)}
                className="h-12 w-12"
              />
            ))}
          </div>
        )}

        <div className="order-1 min-w-0 flex-1 md:order-2">{mainImage}</div>

        {list.length > 1 && (
          <div className="order-3 flex gap-1.5 overflow-x-auto pt-2 scrollbar-hide md:hidden">
            {list.map((img, i) => (
              <Thumbnail
                key={i}
                src={img}
                alt={`${alt} ${i + 1}`}
                active={active === i}
                onClick={() => setActive(i)}
                className="h-11 w-11"
              />
            ))}
          </div>
        )}
      </div>

      {zoomOpen && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-black/95" role="dialog" aria-modal="true">
          <button
            type="button"
            onClick={() => setZoomOpen(false)}
            className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"
            aria-label="Close zoom"
          >
            <CloseIcon />
          </button>

          {list.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl text-white"
                aria-label="Previous"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl text-white"
                aria-label="Next"
              >
                ›
              </button>
            </>
          )}

          <div
            className="flex flex-1 items-center justify-center p-4 pt-14"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <ProductImage src={list[active]} alt={alt} fit="contain" className="max-h-[85vh] max-w-full" />
          </div>

          {list.length > 1 && (
            <div className="border-t border-white/10 px-4 pb-6 pt-4">
              <p className="mb-3 text-center text-sm text-white/70">
                {active + 1} of {list.length}
              </p>
              <div className="flex justify-center gap-2 overflow-x-auto scrollbar-hide">
                {list.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActive(i)}
                    className={`h-12 w-12 shrink-0 overflow-hidden rounded-md border-2 ${
                      active === i ? 'border-brand-green' : 'border-white/20 opacity-70'
                    }`}
                  >
                    <ProductImage src={img} alt="" fit="cover" className="h-full w-full" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
