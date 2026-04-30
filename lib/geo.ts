export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_M = 6371000;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const aRad = (a.lat * Math.PI) / 180;
  const bRad = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aRad) * Math.cos(bRad) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export const NEARBY_THRESHOLD_M = 25;

export interface NearbyCandidate {
  id: string;
  title: string;
  lat: number | null;
  lng: number | null;
}

export function findExistingPin<T extends NearbyCandidate>(
  point: LatLng,
  pins: readonly T[] | undefined,
): T | null {
  if (!pins) return null;
  for (const p of pins) {
    if (p.lat == null || p.lng == null) continue;
    if (
      haversineMeters(point, { lat: p.lat, lng: p.lng }) < NEARBY_THRESHOLD_M
    ) {
      return p;
    }
  }
  return null;
}
