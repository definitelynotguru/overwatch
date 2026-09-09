import { describe, expect, it } from 'vitest'
import { geometriesPresent, searchResultToGeoJSON } from '../src/domain/geojson'
import type { Asset, SearchResult } from '../src/domain/types'

function asset(partial: Partial<Asset> & Pick<Asset, 'id' | 'type'>): Asset {
  return {
    osmType: 'node',
    osmId: 1,
    name: null,
    operator: null,
    lat: 51.5,
    lon: -0.1,
    geometry: { type: 'Point', coordinates: [-0.1, 51.5] },
    tags: {},
    ...partial,
  }
}

function baseResult(over: Partial<SearchResult> = {}): SearchResult {
  return {
    results: [],
    related: [],
    stats: { total: 0, types: {}, operators: {} },
    bounds: null,
    query: {
      type: 'airport',
      operator: null,
      region: null,
      country: null,
      near: 'london',
      radius: 25,
      hops: [],
      raw: 'airports near london',
    },
    place: { name: 'London', kind: 'city', lat: 51.5, lon: -0.1 },
    ...over,
  }
}

describe('searchResultToGeoJSON', () => {
  it('emits a FeatureCollection with subject role properties', () => {
    const subject = asset({
      id: 'node/1',
      osmId: 1,
      name: 'Heathrow',
      type: 'airport',
      operator: 'HAL',
      geometry: { type: 'Point', coordinates: [-0.45, 51.47] },
    })
    const fc = searchResultToGeoJSON(baseResult({ results: [subject], stats: { total: 1, types: { airport: 1 }, operators: {} } }))
    expect(fc.type).toBe('FeatureCollection')
    expect(fc.features).toHaveLength(1)
    expect(fc.features[0]!.properties).toMatchObject({
      id: 'node/1',
      name: 'Heathrow',
      type: 'airport',
      operator: 'HAL',
      role: 'subject',
    })
    expect(fc.features[0]!.properties.hop).toBeUndefined()
    expect(fc.features[0]!.geometry).toEqual({ type: 'Point', coordinates: [-0.45, 51.47] })
  })

  it('includes related features with hop index and hopType', () => {
    const subject = asset({ id: 'way/10', osmId: 10, type: 'pipeline', name: 'Thames', geometry: { type: 'LineString', coordinates: [[-0.14, 51.5], [-0.08, 51.51]] } })
    const relatedAirport = asset({ id: 'node/2', osmId: 2, type: 'airport', name: 'City' })
    const relatedIndustrial = asset({
      id: 'way/3',
      osmId: 3,
      type: 'industrial',
      name: 'Isle',
      geometry: {
        type: 'Polygon',
        coordinates: [[[-0.02, 51.5], [-0.01, 51.5], [-0.01, 51.505], [-0.02, 51.505], [-0.02, 51.5]]],
      },
    })
    const fc = searchResultToGeoJSON(
      baseResult({
        results: [subject],
        related: [
          { type: 'airport', withinM: 30000, assets: [relatedAirport] },
          { type: 'industrial', withinM: 20000, assets: [relatedIndustrial] },
        ],
        stats: { total: 1, types: { pipeline: 1 }, operators: {} },
      }),
    )
    expect(fc.features).toHaveLength(3)
    expect(fc.features[0]!.properties.role).toBe('subject')
    expect(fc.features[1]!.properties).toMatchObject({
      role: 'related',
      hop: 0,
      hopType: 'airport',
      withinM: 30000,
      type: 'airport',
    })
    expect(fc.features[2]!.properties).toMatchObject({
      role: 'related',
      hop: 1,
      hopType: 'industrial',
      withinM: 20000,
    })
    expect(fc.features[0]!.geometry.type).toBe('LineString')
    expect(fc.features[2]!.geometry.type).toBe('Polygon')
  })

  it('falls back to a Point at lon/lat when geometry is missing', () => {
    const orphan = asset({
      id: 'node/9',
      osmId: 9,
      type: 'airport',
      lat: 52.1,
      lon: 13.4,
      geometry: null,
    })
    const fc = searchResultToGeoJSON(baseResult({ results: [orphan], stats: { total: 1, types: {}, operators: {} } }))
    expect(fc.features[0]!.geometry).toEqual({ type: 'Point', coordinates: [13.4, 52.1] })
  })
})

describe('geometriesPresent', () => {
  it('is true when every asset has geometry', () => {
    const result = baseResult({
      results: [asset({ id: 'a', type: 'airport' })],
      related: [{ type: 'bridge', withinM: 1000, assets: [asset({ id: 'b', type: 'bridge' })] }],
      stats: { total: 1, types: {}, operators: {} },
    })
    expect(geometriesPresent(result)).toBe(true)
  })

  it('is false when any asset lacks geometry or the set is empty', () => {
    expect(geometriesPresent(baseResult())).toBe(false)
    const missing = baseResult({
      results: [asset({ id: 'a', type: 'airport', geometry: null })],
      stats: { total: 1, types: {}, operators: {} },
    })
    expect(geometriesPresent(missing)).toBe(false)
  })
})
