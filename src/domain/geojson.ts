import type { Asset, AssetGeometry, SearchResult } from './types'

export type GeoJsonProperties = {
  id: string
  name: string | null
  type: string
  operator: string | null
  osmType: string
  osmId: number
  role: 'subject' | 'related'
  hop?: number
  hopType?: string
  withinM?: number
}

export type GeoJsonFeature = {
  type: 'Feature'
  id: string
  properties: GeoJsonProperties
  geometry: AssetGeometry
}

export type GeoJsonFeatureCollection = {
  type: 'FeatureCollection'
  features: GeoJsonFeature[]
}

function geometryOf(asset: Asset): AssetGeometry {
  if (asset.geometry && typeof asset.geometry.type === 'string' && asset.geometry.coordinates != null) {
    return asset.geometry
  }
  return { type: 'Point', coordinates: [asset.lon, asset.lat] }
}

function subjectFeature(asset: Asset): GeoJsonFeature {
  return {
    type: 'Feature',
    id: asset.id,
    properties: {
      id: asset.id,
      name: asset.name,
      type: asset.type,
      operator: asset.operator,
      osmType: asset.osmType,
      osmId: asset.osmId,
      role: 'subject',
    },
    geometry: geometryOf(asset),
  }
}

function relatedFeature(
  asset: Asset,
  hopIndex: number,
  hopType: string,
  withinM: number,
): GeoJsonFeature {
  return {
    type: 'Feature',
    id: asset.id,
    properties: {
      id: asset.id,
      name: asset.name,
      type: asset.type,
      operator: asset.operator,
      osmType: asset.osmType,
      osmId: asset.osmId,
      role: 'related',
      hop: hopIndex,
      hopType,
      withinM,
    },
    geometry: geometryOf(asset),
  }
}

/** True when every subject/related asset already carries a geometry payload. */
export function geometriesPresent(result: SearchResult): boolean {
  const assets: Asset[] = [
    ...result.results,
    ...result.related.flatMap((r) => r.assets),
  ]
  if (assets.length === 0) return false
  return assets.every(
    (a) => a.geometry != null && typeof a.geometry.type === 'string' && a.geometry.coordinates != null,
  )
}

/** Build one FeatureCollection of subject + related for the current search. */
export function searchResultToGeoJSON(result: SearchResult): GeoJsonFeatureCollection {
  const features: GeoJsonFeature[] = result.results.map(subjectFeature)
  result.related.forEach((hop, hopIndex) => {
    for (const asset of hop.assets) {
      features.push(relatedFeature(asset, hopIndex, hop.type, hop.withinM))
    }
  })
  return { type: 'FeatureCollection', features }
}

function filenameForQuery(q: string): string {
  const slug = q
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return `overwatch-${slug || 'search'}.geojson`
}

function triggerDownload(json: string, filename: string) {
  const blob = new Blob([json], { type: 'application/geo+json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Prefer client-side build from SearchResult; else fetch `/api/search.geojson`. */
export async function downloadSearchGeoJSON(result: SearchResult, q: string): Promise<void> {
  const filename = filenameForQuery(q)
  if (geometriesPresent(result)) {
    triggerDownload(JSON.stringify(searchResultToGeoJSON(result)), filename)
    return
  }
  const res = await fetch(`/api/search.geojson?q=${encodeURIComponent(q)}`)
  if (!res.ok) {
    throw new Error(`GeoJSON export failed (${res.status})`)
  }
  const text = await res.text()
  triggerDownload(text, filename)
}
