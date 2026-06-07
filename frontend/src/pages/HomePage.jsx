import { useMemo, useState } from 'react';
import { useCategories, useFlashSale, useKits, useProducts } from '../hooks/catalog';
import EmptyState from '../components/ui/EmptyState';
import HeroBannerSlider from '../components/home/HeroBannerSlider';
import QuickCategoryCards from '../components/home/QuickCategoryCards';
import FlashDealsSection from '../components/home/FlashDealsSection';
import KitsSection from '../components/home/KitsSection';
import ProductCarousel from '../components/home/ProductCarousel';
import {
  HomeSectionSkeleton,
  SectionDivider,
} from '../components/home/HomeSections';
import StoreValueSection from '../components/home/StoreValueSection';
import { getRecentlyViewed } from '../lib/browseStorage';

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function HomePage() {
  const { data: newestData, isLoading } = useProducts({ sort: 'newest', page: 1, per_page: 24 });
  const { data: featuredData, isLoading: featuredLoading } = useProducts({
    is_featured: '1',
    sort: 'newest',
    page: 1,
    per_page: 10,
  });
  const { data: flashData, isLoading: flashLoading } = useProducts({
    is_flash_deal: '1',
    sort: 'newest',
    page: 1,
    per_page: 6,
  });
  const { data: popularData, isLoading: popularLoading } = useProducts({
    sort: 'price_desc',
    page: 1,
    per_page: 12,
  });
  const { data: flashSale } = useFlashSale();
  const { data: kits = [], isLoading: kitsLoading } = useKits();
  const { data: catData } = useCategories();
  const [recentlyViewed] = useState(() => getRecentlyViewed());

  const products = useMemo(() => newestData?.data ?? [], [newestData?.data]);
  const flashProducts = useMemo(() => flashData?.data ?? [], [flashData?.data]);
  const popular = useMemo(() => popularData?.data ?? [], [popularData?.data]);

  const featuredList = useMemo(() => featuredData?.data ?? [], [featuredData?.data]);
  const featuredProducts = featuredList.length ? featuredList : products.slice(0, 10);
  const newArrivals = products.slice(0, 12);
  const popularProducts = popular.length ? popular.slice(0, 10) : products.slice().reverse().slice(0, 10);

  const recommendations = useMemo(() => {
    const ids = new Set(recentlyViewed.map((p) => p.id));
    const pool = products.filter((p) => !ids.has(p.id));
    return shuffle(pool.length ? pool : products).slice(0, 10);
  }, [products, recentlyViewed]);

  const loading = isLoading || popularLoading || featuredLoading || flashLoading;

  if (!loading && products.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="mt-8">
          <EmptyState
            title="No products yet"
            message="Check back soon — new items are added regularly."
            actionLabel="Browse shop"
            actionTo="/shop"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-4 pb-6 md:space-y-10 md:py-6">
      <HeroBannerSlider />

      <StoreValueSection />

      <QuickCategoryCards categories={catData?.data ?? []} />

      {kitsLoading ? (
        <HomeSectionSkeleton title="Member kits" />
      ) : (
        <KitsSection kits={kits} />
      )}

      <SectionDivider />

      {loading ? (
        <>
          <HomeSectionSkeleton title="Flash deals" />
          <HomeSectionSkeleton title="Featured" />
        </>
      ) : (
        <>
          <FlashDealsSection products={flashProducts} settings={flashSale} />

          <ProductCarousel
            id="featured-heading"
            title="Featured products"
            products={featuredProducts}
            viewAllTo="/shop"
          />

          <ProductCarousel
            id="new-arrivals-heading"
            title="New arrivals"
            products={newArrivals}
            viewAllTo="/shop?sort=newest"
          />

          <ProductCarousel
            id="popular-heading"
            title="Popular products"
            products={popularProducts}
            viewAllTo="/shop?sort=price_desc"
          />
        </>
      )}

      {!loading && recentlyViewed.length > 0 && (
        <>
          <SectionDivider />
          <ProductCarousel
            id="recently-viewed-heading"
            title="Recently viewed"
            products={recentlyViewed}
            viewAllTo="/shop"
          />
        </>
      )}

      {!loading && recommendations.length > 0 && (
        <>
          <SectionDivider />
          <ProductCarousel
            id="recommendations-heading"
            title="Recommended for you"
            products={recommendations}
            viewAllTo="/shop"
          />
        </>
      )}
    </div>
  );
}
