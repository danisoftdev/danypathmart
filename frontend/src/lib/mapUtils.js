/** Shared map helpers — OpenStreetMap + Leaflet. */

export const DEFAULT_MAP_CENTER = [5.6037, -0.187];
export const DEFAULT_MAP_ZOOM = 13;

export function formatLocationLine({ street_address, city, region } = {}) {
  return [street_address, city, region].filter(Boolean).join(', ');
}

export function hasMapPin(latitude, longitude) {
  return latitude != null && longitude != null && !Number.isNaN(Number(latitude)) && !Number.isNaN(Number(longitude));
}

export function googleDirectionsUrl(latitude, longitude) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${latitude},${longitude}`)}`;
}
