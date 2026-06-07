import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRightIcon } from '../icons';
import { usePublicHeroBanners } from '../../hooks/storefront';
import { resolveImageUrl } from '../../lib/currency';

const THEMES = {
  green: {
    panel: 'bg-gradient-to-br from-[#2C7A4B] via-[#2d8550] to-[#174d2f]',
    kicker: 'text-brand-gold',
    title: 'text-white',
    subtitle: 'text-white/90',
    cta: 'bg-white text-[#111111] hover:bg-brand-gold',
    ghost: 'text-white/90 hover:text-white',
    ringA: 'bg-white/15',
    ringB: 'bg-brand-gold/20',
  },
  gold: {
    panel: 'bg-gradient-to-br from-[#F59E0B] via-[#fbbf24] to-[#d97706]',
    kicker: 'text-[#111111]/65',
    title: 'text-[#111111]',
    subtitle: 'text-[#111111]/80',
    cta: 'bg-[#111111] text-white hover:bg-[#2C7A4B]',
    ghost: 'text-[#111111]/75 hover:text-[#111111]',
    ringA: 'bg-white/35',
    ringB: 'bg-[#111111]/8',
  },
  forest: {
    panel: 'bg-gradient-to-br from-[#1a5c38] via-[#2C7A4B] to-[#0F2418]',
    kicker: 'text-brand-gold',
    title: 'text-white',
    subtitle: 'text-white/90',
    cta: 'bg-white text-[#111111] hover:bg-brand-gold',
    ghost: 'text-white/90 hover:text-white',
    ringA: 'bg-white/12',
    ringB: 'bg-emerald-400/15',
  },
};

function HeroVisual({ imageUrl, priority = false }) {
  const src = resolveImageUrl(imageUrl);

  if (!src) return null;

  return (
    <div className="hero-visual mx-auto w-full max-w-[300px] sm:mx-0 lg:max-w-[320px]">
      <div className="hero-visual-card">
        <img
          src={src}
          alt=""
          className="hero-visual-img"
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
        />
      </div>
    </div>
  );
}

export default function HeroBannerSlider() {
  const { data: apiBanners, isLoading } = usePublicHeroBanners();
  const banners = apiBanners ?? [];

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef(null);

  useEffect(() => {
    setIndex(0);
  }, [banners.length]);

  const go = useCallback(
    (next) => {
      if (!banners.length) return;
      setIndex(() => (next + banners.length) % banners.length);
    },
    [banners.length]
  );

  useEffect(() => {
    if (paused || banners.length < 2) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % banners.length), 6000);
    return () => clearInterval(id);
  }, [paused, banners.length]);

  const onTouchStart = (e) => {
    touchStart.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e) => {
    if (touchStart.current == null) return;
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) go(diff > 0 ? index + 1 : index - 1);
    touchStart.current = null;
  };

  if (isLoading && !banners.length) {
    return (
      <section aria-label="Promotional banners" className="relative">
        <div className="h-[220px] animate-pulse rounded-2xl bg-black/5 dark:bg-white/10 sm:h-[260px]" />
      </section>
    );
  }

  if (!banners.length) return null;

  const slide = banners[index];
  const theme = THEMES[slide.theme] || THEMES.green;
  const hasImage = !!slide.image_url;

  return (
    <section
      aria-label="Promotional banners"
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="overflow-hidden rounded-2xl shadow-lg ring-1 ring-black/8 dark:ring-white/10"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          key={slide.id}
          className={`hero-slide-enter relative ${hasImage ? 'min-h-[240px] sm:min-h-[280px]' : 'min-h-[200px] sm:min-h-[240px]'} ${theme.panel}`}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" aria-hidden>
            <div className={`absolute -right-4 top-4 h-32 w-32 rounded-full sm:h-40 sm:w-40 ${theme.ringA}`} />
            <div className={`absolute bottom-2 right-[28%] h-24 w-24 rounded-full sm:right-[32%] sm:h-28 sm:w-28 ${theme.ringB}`} />
            {hasImage && (
              <div className="absolute inset-y-0 right-0 w-[45%] bg-gradient-to-l from-black/20 via-black/5 to-transparent" />
            )}
          </div>

          <div className="relative z-10 flex min-h-[inherit] flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-10 sm:p-8 lg:p-10">
            <div className={`min-w-0 flex-1 ${hasImage ? 'sm:max-w-[52%]' : 'sm:max-w-[58%]'}`}>
              <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${theme.kicker}`}>
                DanyPathMart{slide.kicker ? ` · ${slide.kicker}` : ''}
              </p>
              <h2 className={`mt-2 text-[1.65rem] font-extrabold leading-[1.12] sm:text-3xl lg:text-[2.125rem] ${theme.title}`}>
                {slide.title}
              </h2>
              {slide.subtitle && (
                <p className={`mt-3 max-w-md text-sm leading-relaxed sm:text-base ${theme.subtitle}`}>
                  {slide.subtitle}
                </p>
              )}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link
                  to={slide.link_to || '/shop'}
                  className={`inline-flex min-h-[44px] items-center rounded-xl px-5 py-2.5 text-sm font-bold shadow-md transition ${theme.cta}`}
                >
                  {slide.cta_label || 'Shop now'}
                  <ChevronRightIcon className="ml-1 h-4 w-4" />
                </Link>
                <Link
                  to="/shop"
                  className={`text-sm font-semibold underline-offset-4 transition hover:underline ${theme.ghost}`}
                >
                  View all products
                </Link>
              </div>
            </div>

            {hasImage && (
              <div className="w-full shrink-0 sm:w-[42%] lg:w-[38%]">
                <HeroVisual imageUrl={slide.image_url} priority={index === 0} />
              </div>
            )}
          </div>

          {banners.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(index - 1)}
                className="absolute left-2 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-sm transition hover:bg-black/35 sm:flex"
                aria-label="Previous slide"
              >
                <span className="text-lg leading-none" aria-hidden>
                  ‹
                </span>
              </button>
              <button
                type="button"
                onClick={() => go(index + 1)}
                className="absolute right-2 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-sm transition hover:bg-black/35 sm:flex"
                aria-label="Next slide"
              >
                <span className="text-lg leading-none" aria-hidden>
                  ›
                </span>
              </button>
            </>
          )}
        </div>
      </div>

      {banners.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2" role="tablist" aria-label="Banner slides">
          {banners.map((b, i) => (
            <button
              key={b.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Slide ${i + 1}: ${b.title}`}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === index ? 'w-7 bg-brand-green' : 'w-2 bg-black/15 hover:bg-black/25 dark:bg-white/25 dark:hover:bg-white/40'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
