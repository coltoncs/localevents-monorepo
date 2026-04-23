// Standard style handles light/dark via `lightPreset` config instead of
// swapping style URLs.
export const STANDARD_STYLE = 'mapbox://styles/mapbox/standard'

export type LightPreset = 'dawn' | 'day' | 'dusk' | 'night'

export function getLightPreset(theme: 'light' | 'dark'): LightPreset {
  return theme === 'dark' ? 'night' : 'day'
}

// Slot to place custom layers under labels/POI symbols in Standard style.
export const STANDARD_SLOT_MIDDLE = 'middle'

// Raleigh, NC — default map center when a form has no coords yet.
export const DEFAULT_MAP_CENTER = { lat: 35.7796, lng: -78.6382 }

export function getResolvedTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light'
  const el = document.documentElement
  if (el.getAttribute('data-theme') === 'dark') return 'dark'
  if (el.getAttribute('data-theme') === 'light') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function getMarkerColor(theme: 'light' | 'dark') {
  return theme === 'dark' ? '#60d7cf' : '#4f46e5'
}

export function getCircleColors(theme: 'light' | 'dark') {
  return theme === 'dark'
    ? { fill: 'rgba(96, 215, 207, 0.08)', stroke: 'rgba(96, 215, 207, 0.35)' }
    : { fill: 'rgba(79, 70, 229, 0.06)', stroke: 'rgba(79, 70, 229, 0.3)' }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function createGeoJSONCircle(
  lng: number,
  lat: number,
  radiusMiles: number,
  points = 64,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const radiusKm = radiusMiles * 1.60934
  const coords: [number, number][] = []

  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI
    const dx = radiusKm * Math.cos(angle)
    const dy = radiusKm * Math.sin(angle)
    const newLat = lat + (dy / 6371) * (180 / Math.PI)
    const newLng =
      lng + ((dx / 6371) * (180 / Math.PI)) / Math.cos((lat * Math.PI) / 180)
    coords.push([newLng, newLat])
  }

  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [coords] },
    properties: {},
  }
}
