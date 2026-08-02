import { useEffect, useRef } from 'react';
import { DEFAULT_MAP_ZOOM, addBaseTileLayer, formatLocationLine, googleDirectionsUrl, hasMapPin } from '../../lib/mapUtils';
import 'leaflet/dist/leaflet.css';

function fixLeafletIcons(L) {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

/** Read-only map with optional directions link. */
export default function LocationMapView({
  latitude,
  longitude,
  label,
  streetAddress,
  city,
  region,
  directionsUrl,
  height = 240,
  className = '',
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const pinOk = hasMapPin(latitude, longitude);
  const lat = pinOk ? Number(latitude) : 0;
  const lng = pinOk ? Number(longitude) : 0;
  const addressLine = formatLocationLine({ street_address: streetAddress, city, region });
  const href = pinOk ? (directionsUrl || googleDirectionsUrl(lat, lng)) : '';

  useEffect(() => {
    if (!pinOk) return;
    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      fixLeafletIcons(L);
      const el = containerRef.current;
      if (el._leaflet_id) {
        el._leaflet_id = undefined;
        el.innerHTML = '';
      }
      const map = L.map(el, { scrollWheelZoom: false }).setView([lat, lng], DEFAULT_MAP_ZOOM);
      addBaseTileLayer(L, map);
      L.marker([lat, lng]).addTo(map);
      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 50);
      setTimeout(() => map.invalidateSize(), 250);
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [lat, lng, pinOk]);

  if (!pinOk) {
    return null;
  }

  return (
    <div className={className}>
      {label && <p className="mb-2 text-sm font-bold">{label}</p>}
      {addressLine && <p className="mb-2 text-sm text-muted">{addressLine}</p>}
      <div
        ref={containerRef}
        className="leaflet-container z-0 w-full overflow-hidden rounded-xl border border-black/10 dark:border-white/10"
        style={{ height, minHeight: height }}
      />
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex min-h-[44px] items-center text-sm font-bold text-brand-green hover:underline"
      >
        Get directions →
      </a>
    </div>
  );
}
