import { useEffect, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { usePublicStore } from '../hooks/shop';
import ProductCard from '../components/product/ProductCard';
import LocationMapView from '../components/map/LocationMapView';
import { resolveProductImageUrl } from '../lib/productImages';
import EmptyState from '../components/ui/EmptyState';
import { ProductGridSkeleton } from '../components/ui/Skeleton';
import { useStoreCartStore } from '../store/storeCartStore';

function phoneDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function looksLikePhone(phone) {
  const digits = phoneDigits(phone);
  return digits.length >= 9 && digits.length <= 15;
}

function waMeUrl(phone) {
  const digits = phoneDigits(phone);
  if (!looksLikePhone(phone)) return null;
  const normalized = digits.startsWith('0') ? `233${digits.slice(1)}` : digits;
  return `https://wa.me/${normalized}`;
}

function PhoneLinks({ label, phone }) {
  if (!phone) return null;
  const tel = looksLikePhone(phone) ? `tel:${phoneDigits(phone)}` : null;
  const wa = waMeUrl(phone);
  return (
    <p className="mt-1 text-sm">
      <span className="text-muted">{label}: </span>
      {tel ? (
        <a href={tel} className="font-semibold text-brand-green hover:underline">{phone}</a>
      ) : (
        <span className="font-semibold">{phone}</span>
      )}
      {wa && (
        <>
          {' · '}
          <a href={wa} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-green hover:underline">
            WhatsApp
          </a>
        </>
      )}
    </p>
  );
}

export default function StorePage() {
  const { slug } = useParams();
  const { data, isLoading, isError } = usePublicStore(slug);
  const setShop = useStoreCartStore((s) => s.setShop);
  const { shop: layoutShop } = useOutletContext() ?? {};
  const [copied, setCopied] = useState(false);

  const shop = layoutShop || data?.shop;
  const products = data?.products ?? [];

  useEffect(() => {
    if (shop?.slug) setShop(shop.slug, shop.name);
  }, [shop?.slug, shop?.name, setShop]);

  useEffect(() => {
    if (!products.length) return;
    const hash = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '';
    if (!hash.startsWith('product-')) return;
    const el = document.getElementById(hash);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-brand-green');
      window.setTimeout(() => el.classList.remove('ring-2', 'ring-brand-green'), 2500);
    }
  }, [products]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 pb-24">
        <div className="mb-8 h-24 animate-pulse rounded-2xl bg-black/5 dark:bg-white/5" />
        <ProductGridSkeleton count={8} />
      </div>
    );
  }

  if (isError || !shop) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <EmptyState title="Store not found" message="This shop may be inactive or the link is incorrect." />
      </div>
    );
  }

  const storeUrl = typeof window !== 'undefined' ? `${window.location.origin}/stores/${shop.slug}` : `/stores/${shop.slug}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 pb-24 md:py-10">
      <header className="mb-8 flex flex-col gap-4 rounded-2xl border border-black/8 bg-white p-5 dark:border-white/10 dark:bg-[#1E1E1E] sm:flex-row sm:items-center">
        {shop.logo_url ? (
          <img src={resolveProductImageUrl(shop.logo_url)} alt="" className="h-20 w-20 rounded-2xl object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-green/10 text-2xl font-extrabold text-brand-green">
            {shop.name.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold text-[#111111] dark:text-white md:text-3xl">{shop.name}</h1>
          {shop.city && <p className="mt-1 text-sm text-muted">{shop.city}</p>}
          {(shop.contact_phone || shop.customer_service_phone) && (
            <div className="mt-2">
              <PhoneLinks label="Shop phone" phone={shop.contact_phone} />
              <PhoneLinks label="Customer service" phone={shop.customer_service_phone} />
            </div>
          )}
          {shop.description && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{shop.description}</p>}
          {shop.allows_shop_pickup && (
            <p className="mt-2 inline-block rounded-full bg-brand-gold/15 px-2.5 py-0.5 text-xs font-bold text-brand-gold">
              In-person pickup available
            </p>
          )}
        </div>
        <button type="button" onClick={copyLink} className="shrink-0 rounded-xl border-2 border-brand-green px-4 py-2 text-sm font-bold text-brand-green">
          {copied ? 'Link copied!' : 'Share shop link'}
        </button>
      </header>

      {shop.has_map_pin && (
        <section className="mb-8 rounded-2xl border border-black/8 bg-white p-5 dark:border-white/10 dark:bg-[#1E1E1E]">
          <LocationMapView
            latitude={shop.latitude}
            longitude={shop.longitude}
            streetAddress={shop.street_address}
            city={shop.city}
            region={shop.region}
            directionsUrl={shop.directions_url}
            label="Find this shop"
            height={260}
          />
        </section>
      )}

      {products.length === 0 ? (
        <p className="text-sm text-muted">No products listed yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} storeMode shopSlug={shop.slug} shopName={shop.name} />
          ))}
        </div>
      )}
    </div>
  );
}
