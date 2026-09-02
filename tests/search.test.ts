import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { searchAssets } from '../src/db/search'
import { sql } from '../src/db/client'
import { isSearchError } from '../src/domain/types'


beforeAll(async () => {
  await sql`
    INSERT INTO places (name, aliases, kind, geom, bbox) VALUES
      ('Berlin', ARRAY['berlin de', 'berlin germany']::text[], 'city',
        ST_SetSRID(ST_MakePoint(13.4050, 52.5200), 4326)::geography,
        ST_MakeEnvelope(13.088, 52.338, 13.761, 52.675, 4326)),
      ('Texas', ARRAY['tx', 'texas us']::text[], 'region',
        ST_SetSRID(ST_MakePoint(-99.9018, 31.9686), 4326)::geography,
        ST_MakeEnvelope(-106.646, 25.837, -93.508, 36.501, 4326))
    ON CONFLICT ((lower(name))) DO UPDATE SET
      aliases = EXCLUDED.aliases,
      kind = EXCLUDED.kind,
      geom = EXCLUDED.geom,
      bbox = EXCLUDED.bbox
  `
})

afterAll(async () => {
  await sql.end({ timeout: 2 })
})

describe('searchAssets', () => {
  it('returns seeded airports near london with plausible coordinates', async () => {
    const out = await searchAssets('airports near london')
    expect(isSearchError(out)).toBe(false)
    if (isSearchError(out)) return
    expect(out.stats.total).toBeGreaterThan(5)
    expect(out.results.length).toBeGreaterThan(5)
    expect(out.results.every((a) => a.type === 'airport')).toBe(true)
    const heathrow = out.results.find((a) => a.name?.includes('Heathrow'))
    expect(heathrow).toBeTruthy()
    expect(heathrow!.lat).toBeGreaterThan(51)
    expect(heathrow!.lat).toBeLessThan(52)
    expect(heathrow!.lon).toBeGreaterThan(-1)
    expect(heathrow!.lon).toBeLessThan(1)
    for (const a of out.results) {
      expect(a.lat).toBeGreaterThan(50.5)
      expect(a.lat).toBeLessThan(52.5)
      expect(a.lon).toBeGreaterThan(-2)
      expect(a.lon).toBeLessThan(2)
    }
  })

  it('returns seeded bridges in new york inside the city bbox', async () => {
    const out = await searchAssets('bridges in new york')
    expect(isSearchError(out)).toBe(false)
    if (isSearchError(out)) return
    expect(out.stats.total).toBeGreaterThan(10)
    expect(out.results.some((a) => a.name?.includes('Brooklyn Bridge'))).toBe(true)
    for (const a of out.results) {
      expect(a.type).toBe('bridge')
      expect(a.lat).toBeGreaterThan(40.4)
      expect(a.lat).toBeLessThan(41.0)
      expect(a.lon).toBeGreaterThan(-74.3)
      expect(a.lon).toBeLessThan(-73.6)
    }
  })

  it('honors structured type:airport near:london radius:50', async () => {
    const out = await searchAssets('type:airport near:london radius:50')
    expect(isSearchError(out)).toBe(false)
    if (isSearchError(out)) return
    expect(out.query.type).toBe('airport')
    expect(out.query.near).toBe('london')
    expect(out.query.radius).toBe(50)
    expect(out.stats.total).toBeGreaterThan(5)
    expect(out.results[0]?.type).toBe('airport')
  })

  it('finds telecom in karnataka', async () => {
    const out = await searchAssets('telecom towers in karnataka')
    expect(isSearchError(out)).toBe(false)
    if (isSearchError(out)) return
    expect(out.stats.total).toBeGreaterThan(5)
    expect(out.results.every((a) => a.type === 'telecom')).toBe(true)
  })

  it('returns unknown_place for airports near atlantis', async () => {
    const out = await searchAssets('airports near atlantis')
    expect(isSearchError(out)).toBe(true)
    if (!isSearchError(out)) return
    expect(out.code).toBe('unknown_place')
  })

  it('returns invalid_query for near london, airports, and empty string', async () => {
    for (const q of ['near london', 'airports', '']) {
      const out = await searchAssets(q)
      expect(isSearchError(out)).toBe(true)
      if (!isSearchError(out)) continue
      expect(out.code).toBe('invalid_query')
    }
  })

  it('returns the same count for operator airtel vs Airtel', async () => {
    const lower = await searchAssets('operator:airtel region:karnataka')
    const mixed = await searchAssets('operator:Airtel region:karnataka')
    expect(isSearchError(lower)).toBe(false)
    expect(isSearchError(mixed)).toBe(false)
    if (isSearchError(lower) || isSearchError(mixed)) return
    expect(lower.stats.total).toBeGreaterThan(0)
    expect(lower.stats.total).toBe(mixed.stats.total)
  })

  it('does not treat operator percent or underscore as a wildcard', async () => {
    const all = await searchAssets('airports near london')
    const pct = await searchAssets('type:airport operator:% near:london')
    const under = await searchAssets('type:airport operator:_ near:london')
    expect(isSearchError(all)).toBe(false)
    expect(isSearchError(pct)).toBe(false)
    expect(isSearchError(under)).toBe(false)
    if (isSearchError(all) || isSearchError(pct) || isSearchError(under)) return
    expect(all.stats.total).toBeGreaterThan(0)
    expect(pct.stats.total).toBeLessThan(all.stats.total)
    expect(under.stats.total).toBeLessThan(all.stats.total)
  })

  it('returns a smaller or equal total for radius 5 near london than the default', async () => {
    const def = await searchAssets('airports near london')
    const tight = await searchAssets('airports near london radius:5')
    expect(isSearchError(def)).toBe(false)
    expect(isSearchError(tight)).toBe(false)
    if (isSearchError(def) || isSearchError(tight)) return
    expect(tight.stats.total).toBeLessThanOrEqual(def.stats.total)
  })

  it('returns total 0 rather than an error for a no-hit query', async () => {
    const out = await searchAssets('type:zoo near:london')
    expect(isSearchError(out)).toBe(false)
    if (isSearchError(out)) return
    expect(out.stats.total).toBe(0)
    expect(out.results).toEqual([])
  })

  it('never returns more than 500 results', async () => {
    const out = await searchAssets('airports near london')
    expect(isSearchError(out)).toBe(false)
    if (isSearchError(out)) return
    expect(out.results.length).toBeLessThanOrEqual(500)
  })

  it('does not treat type:airport country:france as invalid_query', async () => {
    const out = await searchAssets('type:airport country:france')
    if (isSearchError(out)) {
      expect(out.code).not.toBe('invalid_query')
    } else {
      expect(out.stats.total).toBeGreaterThanOrEqual(0)
    }
  })

  it('tight near radius is not larger than region for telecom in karnataka', async () => {
    const region = await searchAssets('telecom in karnataka')
    const tight = await searchAssets('telecom near karnataka radius:5')
    expect(isSearchError(region)).toBe(false)
    expect(isSearchError(tight)).toBe(false)
    if (isSearchError(region) || isSearchError(tight)) return
    expect(typeof region.stats.total).toBe('number')
    expect(typeof tight.stats.total).toBe('number')
    expect(region.stats.total).toBeGreaterThanOrEqual(0)
    expect(tight.stats.total).toBeGreaterThanOrEqual(0)
    expect(tight.stats.total).toBeLessThanOrEqual(region.stats.total)
  })

  it('returns real linestring geometry for the seeded Thames pipeline', async () => {
    const out = await searchAssets('pipelines near london')
    expect(isSearchError(out)).toBe(false)
    if (isSearchError(out)) return
    const pipe = out.results.find((a) => a.name?.includes('Thames'))
    expect(pipe).toBeTruthy()
    expect(pipe!.geometry?.type).toBe('LineString')
    expect(pipe!.geometry?.type).not.toBe('Point')
    const coords = pipe!.geometry?.coordinates as number[][]
    expect(Array.isArray(coords)).toBe(true)
    expect(coords.length).toBeGreaterThan(1)
    expect(coords[0]?.length).toBeGreaterThanOrEqual(2)
  })

  it('returns real polygon geometry for the seeded industrial estate', async () => {
    const out = await searchAssets('type:industrial near:london')
    expect(isSearchError(out)).toBe(false)
    if (isSearchError(out)) return
    const poly = out.results.find((a) => a.name?.includes('Isle of Dogs'))
    expect(poly).toBeTruthy()
    expect(poly!.geometry?.type).toBe('Polygon')
  })

  it('resolves fixture place Berlin instead of unknown_place', async () => {
    const out = await searchAssets('airports near berlin')
    expect(isSearchError(out)).toBe(false)
    if (isSearchError(out)) return
    expect(out.place?.name).toMatch(/berlin/i)
    expect(out.place?.kind).toBe('city')
  })

  it('resolves fixture place Texas instead of unknown_place', async () => {
    const out = await searchAssets('airports in texas')
    expect(isSearchError(out)).toBe(false)
    if (isSearchError(out)) return
    expect(out.place?.name).toMatch(/texas/i)
    expect(out.place?.kind).toBe('region')
  })
})
