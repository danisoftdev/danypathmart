import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  PIN_MAP_ZOOM,
  hasMapPin,
  normalizeCoords,
  reverseGeocode,
  searchMapPlaces,
} from '../../lib/mapUtils';
import 'leaflet/dist/leaflet.css';

function fixLeafletIcons(L) {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

/**
 * Click / drag pin, use GPS, enter coordinates, or search a place.
 * onChange({ latitude, longitude, street_address?, city?, region? })
 */
export default function LocationMapPicker({
  latitude,
  longitude,
  onChange,
  height = 280,
  className = '',
  suggestAddress = true,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const leafletRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const placeMarkerRef = useRef(() => {});

  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [worldwide, setWorldwide] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [latText, setLatText] = useState(hasMapPin(latitude, longitude) ? String(Number(latitude)) : '');
  const [lngText, setLngText] = useState(hasMapPin(latitude, longitude) ? String(Number(longitude)) : '');
  const [coordError, setCoordError] = useState('');

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (hasMapPin(latitude, longitude)) {
      setLatText(String(Number(latitude)));
      setLngText(String(Number(longitude)));
    }
  }, [latitude, longitude]);

  const emitPin = async (lat, lng, extras = {}, { reverse = false } = {}) => {
    const coords = normalizeCoords(lat, lng);
    if (!coords) return;
    let payload = { ...coords, ...extras };
    if (reverse && suggestAddress && !extras.street_address && !extras.city) {
      try {
        const addr = await reverseGeocode(coords.latitude, coords.longitude);
        payload = { ...payload, ...addr };
      } catch {
        /* keep coords only */
      }
    }
    onChangeRef.current?.(payload);
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      leafletRef.current = L;
      fixLeafletIcons(L);
      const start = hasMapPin(latitude, longitude) ? [Number(latitude), Number(longitude)] : DEFAULT_MAP_CENTER;
      const zoom = hasMapPin(latitude, longitude) ? PIN_MAP_ZOOM : DEFAULT_MAP_ZOOM;
      const map = L.map(containerRef.current, { scrollWheelZoom: true }).setView(start, zoom);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const placeMarker = (lat, lng, { fly = false } = {}) => {
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map);
          markerRef.current.on('dragend', () => {
            const pos = markerRef.current.getLatLng();
            emitPin(pos.lat, pos.lng, {}, { reverse: true });
          });
        }
        if (fly) map.flyTo([lat, lng], Math.max(map.getZoom(), PIN_MAP_ZOOM), { duration: 0.6 });
        else map.setView([lat, lng], Math.max(map.getZoom(), PIN_MAP_ZOOM));
      };
      placeMarkerRef.current = placeMarker;

      if (hasMapPin(latitude, longitude)) {
        placeMarker(Number(latitude), Number(longitude));
      }

      map.on('click', (e) => {
        placeMarker(e.latlng.lat, e.latlng.lng);
        emitPin(e.latlng.lat, e.latlng.lng, {}, { reverse: true });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map mounts once
  }, []);

  useEffect(() => {
    if (!mapRef.current || !hasMapPin(latitude, longitude)) return;
    placeMarkerRef.current?.(Number(latitude), Number(longitude));
  }, [latitude, longitude]);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError('');
      return undefined;
    }

    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      try {
        let rows = await searchMapPlaces(q, {
          signal: ctrl.signal,
          countrycodes: worldwide ? '' : 'gh',
        });
        if (!worldwide && rows.length === 0) {
          rows = await searchMapPlaces(q, { signal: ctrl.signal, countrycodes: '' });
        }
        setResults(rows);
        if (rows.length === 0) setSearchError('No places found. Try a clearer address or landmarks.');
      } catch (err) {
        if (err?.name !== 'AbortError') {
          setResults([]);
          setSearchError(err.message || 'Search failed. Try again.');
        }
      } finally {
        setSearching(false);
      }
    }, 450);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [search, worldwide]);

  const useCurrentLocation = () => {
    setGeoError('');
    if (!navigator.geolocation) {
      setGeoError('This browser does not support location.');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          placeMarkerRef.current?.(lat, lng, { fly: true });
          await emitPin(lat, lng, {}, { reverse: true });
        } finally {
          setGeoLoading(false);
        }
      },
      (err) => {
        setGeoLoading(false);
        if (err?.code === 1) setGeoError('Location permission denied. Allow access or search / enter coordinates.');
        else if (err?.code === 3) setGeoError('Location timed out. Try again or enter coordinates.');
        else setGeoError('Could not read your location. Try search or coordinates.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const applyCoordinates = (e) => {
    e?.preventDefault?.();
    setCoordError('');
    const coords = normalizeCoords(latText, lngText);
    if (!coords) {
      setCoordError('Enter valid latitude (−90 to 90) and longitude (−180 to 180).');
      return;
    }
    placeMarkerRef.current?.(coords.latitude, coords.longitude, { fly: true });
    emitPin(coords.latitude, coords.longitude, {}, { reverse: true });
  };

  const pickResult = (row) => {
    setSearch(row.label || '');
    setResults([]);
    placeMarkerRef.current?.(row.latitude, row.longitude, { fly: true });
    emitPin(row.latitude, row.longitude, {
      street_address: row.street_address,
      city: row.city,
      region: row.region,
    });
  };

  const clearPin = () => {
    setLatText('');
    setLngText('');
    setCoordError('');
    if (markerRef.current && mapRef.current) {
      mapRef.current.removeLayer(markerRef.current);
      markerRef.current = null;
    }
    onChangeRef.current?.({ latitude: null, longitude: null });
  };

  return (
    <div className={className}>
      <div className="mb-3 space-y-3">
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">
            Search location
          </label>
          <div className="relative">
            <input
              type="search"
              className="input-field w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. Oxford Street Accra, Madina Market…"
              autoComplete="off"
            />
            {searching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">Searching…</span>
            )}
            {results.length > 0 && (
              <ul
                className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-black/10 bg-white py-1 shadow-lg dark:border-white/15 dark:bg-[#1E1E1E]"
                role="listbox"
              >
                {results.map((row) => (
                  <li key={`${row.latitude},${row.longitude},${row.label}`}>
                    <button
                      type="button"
                      role="option"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-brand-green/10"
                      onClick={() => pickResult(row)}
                    >
                      {row.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={worldwide}
              onChange={(e) => setWorldwide(e.target.checked)}
              className="accent-brand-green"
            />
            Search outside Ghana
          </label>
          {searchError && <p className="mt-1 text-xs text-brand-red">{searchError}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={geoLoading}
            className="btn-primary min-h-[40px] px-3 text-sm"
          >
            {geoLoading ? 'Getting location…' : 'Use current location'}
          </button>
          {hasMapPin(latitude, longitude) && (
            <button type="button" onClick={clearPin} className="btn-ghost min-h-[40px] px-3 text-sm">
              Clear pin
            </button>
          )}
        </div>
        {geoError && <p className="text-xs text-brand-red">{geoError}</p>}

        <form onSubmit={applyCoordinates} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold text-muted">Latitude</span>
            <input
              className="input-field w-full"
              inputMode="decimal"
              value={latText}
              onChange={(e) => setLatText(e.target.value)}
              placeholder="5.6037"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold text-muted">Longitude</span>
            <input
              className="input-field w-full"
              inputMode="decimal"
              value={lngText}
              onChange={(e) => setLngText(e.target.value)}
              placeholder="-0.1870"
            />
          </label>
          <div className="flex items-end">
            <button type="submit" className="btn-ghost min-h-[44px] w-full px-4 text-sm sm:w-auto">
              Set pin
            </button>
          </div>
        </form>
        {coordError && <p className="text-xs text-brand-red">{coordError}</p>}
      </div>

      <div
        ref={containerRef}
        className="z-0 w-full overflow-hidden rounded-xl border border-black/10 dark:border-white/10"
        style={{ height }}
        role="application"
        aria-label="Map — click to set location"
      />
      <p className="mt-2 text-xs text-muted">
        Search an address, use your current GPS location, enter coordinates, or click / drag the pin on the map.
      </p>
    </div>
  );
}
