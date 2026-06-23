import { useEffect, useRef } from 'react';
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, hasMapPin } from '../../lib/mapUtils';
import 'leaflet/dist/leaflet.css';

function fixLeafletIcons(L) {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

/** Click or drag to set a map pin (Leaflet + OpenStreetMap). */
export default function LocationMapPicker({
  latitude,
  longitude,
  onChange,
  height = 280,
  className = '',
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      fixLeafletIcons(L);
      const start = hasMapPin(latitude, longitude) ? [Number(latitude), Number(longitude)] : DEFAULT_MAP_CENTER;
      const map = L.map(containerRef.current, { scrollWheelZoom: true }).setView(start, DEFAULT_MAP_ZOOM);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const placeMarker = (lat, lng) => {
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map);
          markerRef.current.on('dragend', () => {
            const pos = markerRef.current.getLatLng();
            onChangeRef.current?.({ latitude: pos.lat, longitude: pos.lng });
          });
        }
      };

      if (hasMapPin(latitude, longitude)) {
        placeMarker(Number(latitude), Number(longitude));
      }

      map.on('click', (e) => {
        placeMarker(e.latlng.lat, e.latlng.lng);
        onChangeRef.current?.({ latitude: e.latlng.lat, longitude: e.latlng.lng });
      });

      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 100);
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !hasMapPin(latitude, longitude)) return;
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    }
    mapRef.current.setView([lat, lng], mapRef.current.getZoom());
  }, [latitude, longitude]);

  return (
    <div className={className}>
      <div
        ref={containerRef}
        className="z-0 w-full overflow-hidden rounded-xl border border-black/10 dark:border-white/10"
        style={{ height }}
        role="application"
        aria-label="Map — click to set location"
      />
      <p className="mt-2 text-xs text-muted">Click the map or drag the pin to set your location.</p>
    </div>
  );
}
