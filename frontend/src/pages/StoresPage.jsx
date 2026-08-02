import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { resolveProductImageUrl } from '../lib/productImages';
import EmptyState from '../components/ui/EmptyState';
import ProductRating from '../components/product/ProductRating';
import { addBaseTileLayer, hasMapPin } from '../lib/mapUtils';
import 'leaflet/dist/leaflet.css';

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function usePublicShops(q, city) {
  return useQuery({
    queryKey: ['public-shops', q, city],
    queryFn: async () =>
      (await api.get('/public/shops', { params: { q: q || undefined, city: city || undefined } })).data,
  });
}

export function ShopsMap({ shops }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const pinned = useMemo(() => shops.filter((s) => hasMapPin(s.latitude, s.longitude)), [shops]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!containerRef.current || pinned.length === 0) return;
      const L = (await import('leaflet')).default;
      if (cancelled || mapRef.current) return;

      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const el = containerRef.current;
      if (el._leaflet_id) {
        el._leaflet_id = undefined;
        el.innerHTML = '';
      }
      const map = L.map(el).setView([5.6037, -0.187], 12);
      addBaseTileLayer(L, map);

      if (!document.getElementById('shop-map-marker-css')) {
        const style = document.createElement('style');
        style.id = 'shop-map-marker-css';
        style.textContent = '.shop-map-marker{background:transparent!important;border:none!important;}';
        document.head.appendChild(style);
      }

      const bounds = [];
      pinned.forEach((shop) => {
        const lat = Number(shop.latitude);
        const lng = Number(shop.longitude);
        bounds.push([lat, lng]);
        const name = escapeHtml(shop.name);
        const slug = encodeURIComponent(shop.slug || '');
        const logoUrl = shop.logo_url ? escapeHtml(resolveProductImageUrl(shop.logo_url)) : '';
        const initial = escapeHtml((shop.name || '?').charAt(0).toUpperCase());
        const iconHtml = logoUrl
          ? `<div style="width:40px;height:40px;border-radius:50%;overflow:hidden;border:2px solid #1B5E3B;box-shadow:0 2px 6px rgba(0,0,0,.25);background:#fff"><img src="${logoUrl}" alt="" style="width:100%;height:100%;object-fit:cover"/></div>`
          : `<div style="width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #1B5E3B;background:#E8F5E9;color:#1B5E3B;font-weight:800;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,.25)">${initial}</div>`;
        const icon = L.divIcon({
          className: 'shop-map-marker',
          html: iconHtml,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
          popupAnchor: [0, -18],
        });
        L.marker([lat, lng], { icon })
          .addTo(map)
          .bindPopup(`<strong>${name}</strong><br/><a href="/stores/${slug}">View shop</a>`);
      });
      if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [24, 24] });
      } else if (bounds.length === 1) {
        map.setView(bounds[0], 14);
      }
      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 100);
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [pinned]);

  if (pinned.length === 0) {
    return <p className="mt-6 text-sm text-muted">No shops with map pins yet. Check the list view.</p>;
  }

  return (
    <div
      ref={containerRef}
      className="mt-6 z-0 h-[420px] w-full overflow-hidden rounded-2xl border border-black/10 dark:border-white/10"
    />
  );
}

export default function StoresPage() {
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [view, setView] = useState('list');
  const { data, isLoading } = usePublicShops(q, city);
  const shops = data?.data ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 pb-24 md:py-10">
      <nav className="mb-4 text-sm text-muted">
        <Link to="/" className="hover:text-brand-green">Home</Link>
        {' / '}
        <span>Stores</span>
      </nav>
      <h1 className="text-2xl font-extrabold md:text-3xl">Browse shops</h1>
      <p className="mt-2 text-sm text-muted">Find sellers on DanyPathMart by name, city, or map.</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          className="input-field flex-1"
          placeholder="Search shop name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <input
          className="input-field sm:max-w-xs"
          placeholder="City (optional)"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
        <div className="flex rounded-xl border border-black/10 p-1 dark:border-white/10">
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-sm font-bold ${view === 'list' ? 'bg-brand-green text-white' : ''}`}
            onClick={() => setView('list')}
          >
            List
          </button>
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-sm font-bold ${view === 'map' ? 'bg-brand-green text-white' : ''}`}
            onClick={() => setView('map')}
          >
            Map
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="mt-8 text-sm text-muted">Loading shops…</p>
      ) : shops.length === 0 ? (
        <div className="mt-10">
          <EmptyState title="No shops found" message="Try a different search or check back later." actionLabel="Browse products" actionTo="/shop" />
        </div>
      ) : view === 'map' ? (
        <ShopsMap shops={shops} />
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shops.map((shop) => (
            <Link
              key={shop.id}
              to={`/stores/${shop.slug}`}
              className="flex gap-4 rounded-2xl border border-black/8 bg-white p-4 transition hover:shadow-md dark:border-white/10 dark:bg-[#1E1E1E]"
            >
              {shop.logo_url ? (
                <img src={resolveProductImageUrl(shop.logo_url)} alt="" className="h-16 w-16 rounded-xl object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-brand-green/10 text-xl font-bold text-brand-green">
                  {shop.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="font-bold">{shop.name}</h2>
                {shop.city && <p className="text-xs text-muted">{shop.city}</p>}
                <ProductRating product={{ rating_avg: shop.rating_avg, rating_count: shop.rating_count }} />
                <p className="mt-1 text-xs text-muted">{shop.product_count} product{shop.product_count === 1 ? '' : 's'}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
