/** Shared map helpers — OpenStreetMap + Leaflet + Nominatim. */

export const DEFAULT_MAP_CENTER = [5.6037, -0.187];
export const DEFAULT_MAP_ZOOM = 13;
export const PIN_MAP_ZOOM = 16;

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

export function formatLocationLine({ street_address, city, region } = {}) {
  return [street_address, city, region].filter(Boolean).join(', ');
}

export function hasMapPin(latitude, longitude) {
  return latitude != null && longitude != null && !Number.isNaN(Number(latitude)) && !Number.isNaN(Number(longitude));
}

export function normalizeCoords(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

export function googleDirectionsUrl(latitude, longitude) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${latitude},${longitude}`)}`;
}

function addressFromNominatim(result) {
  if (!result) return {};
  const a = result.address || {};
  const road = [a.house_number, a.road || a.pedestrian || a.path].filter(Boolean).join(' ').trim();
  const street_address = road || a.suburb || a.neighbourhood || '';
  const city = a.city || a.town || a.village || a.municipality || a.county || '';
  const region = a.state || a.region || a.state_district || '';
  return {
    street_address: street_address || undefined,
    city: city || undefined,
    region: region || undefined,
    label: result.display_name || undefined,
  };
}

/** Search places (Nominatim). Defaults to Ghana; pass countrycodes='' for worldwide. */
export async function searchMapPlaces(query, { signal, countrycodes = 'gh', limit = 6 } = {}) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];

  const url = new URL(`${NOMINATIM_BASE}/search`);
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', String(limit));
  if (countrycodes) url.searchParams.set('countrycodes', countrycodes);

  const res = await fetch(url.toString(), {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error('Location search failed.');
  const rows = await res.json();
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => {
      const coords = normalizeCoords(row.lat, row.lon);
      if (!coords) return null;
      const addr = addressFromNominatim(row);
      return {
        ...coords,
        label: row.display_name,
        street_address: addr.street_address,
        city: addr.city,
        region: addr.region,
      };
    })
    .filter(Boolean);
}

/** Reverse-geocode a pin into street / city / region. */
export async function reverseGeocode(lat, lng, { signal } = {}) {
  const coords = normalizeCoords(lat, lng);
  if (!coords) return {};

  const url = new URL(`${NOMINATIM_BASE}/reverse`);
  url.searchParams.set('lat', String(coords.latitude));
  url.searchParams.set('lon', String(coords.longitude));
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');

  const res = await fetch(url.toString(), {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return {};
  const row = await res.json();
  return addressFromNominatim(row);
}
