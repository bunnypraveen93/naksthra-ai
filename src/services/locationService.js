import { API_ENDPOINTS } from '../config/endpoints';

export const nakshatraClientLocation = {
  city: null,
  lat: null,
  lon: null,
  resolved: false
};

let locationWarmupPromise = null;

export async function warmNakshatraLocation() {
  if (nakshatraClientLocation.resolved) return nakshatraClientLocation;
  if (locationWarmupPromise) return locationWarmupPromise;
  locationWarmupPromise = (async () => {
    try {
      const geoRes = await fetch(API_ENDPOINTS.MY_LOCATION).catch(() => null);
      if (geoRes && geoRes.ok) {
        const geo = await geoRes.json().catch(() => null);
        if (geo && geo.ok) {
          if (geo.city) nakshatraClientLocation.city = geo.city;
          if (Number.isFinite(Number(geo.latitude)) && Number.isFinite(Number(geo.longitude))) {
            nakshatraClientLocation.lat = Number(geo.latitude);
            nakshatraClientLocation.lon = Number(geo.longitude);
          }
        }
      }
      // Silently refine with browser GPS only if user already granted location permission (never shows a popup)
      if (navigator.permissions && navigator.geolocation) {
        const perm = await navigator.permissions.query({ name: 'geolocation' }).catch(() => null);
        if (perm && perm.state === 'granted') {
          await new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                if (pos && pos.coords) {
                  nakshatraClientLocation.lat = pos.coords.latitude;
                  nakshatraClientLocation.lon = pos.coords.longitude;
                }
                resolve();
              },
              () => resolve(),
              { enableHighAccuracy: false, timeout: 2500, maximumAge: 600000 }
            );
          });
        }
      }
    } catch {}
    nakshatraClientLocation.resolved = true;
    return nakshatraClientLocation;
  })();
  return locationWarmupPromise;
}

export function getClientLocationPayload() {
  return nakshatraClientLocation.lat !== null && nakshatraClientLocation.lon !== null
    ? {
        lat: nakshatraClientLocation.lat,
        lon: nakshatraClientLocation.lon,
        city: nakshatraClientLocation.city || null
      }
    : null;
}

export function getClientTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
}
