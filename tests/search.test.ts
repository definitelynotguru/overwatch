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
    ON CONFLICT ((lower(name)), kind) DO UPDATE SET
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
    const [centroid] = await sql<{ lat: number; lon: number }[]>`
      SELECT ST_Y(centroid::geometry) AS lat, ST_X(centroid::geometry) AS lon
      FROM assets
      WHERE osm_id = 9100000001
    `
    expect(Number(pipe!.lat)).toBe(Number(centroid.lat))
    expect(Number(pipe!.lon)).toBe(Number(centroid.lon))
    expect(out.bounds).toBeTruthy()
    expect(out.bounds![0]).toBeLessThanOrEqual(-0.14)
    expect(out.bounds![1]).toBeLessThanOrEqual(51.501)
    expect(out.bounds![2]).toBeGreaterThanOrEqual(-0.08)
    expect(out.bounds![3]).toBeGreaterThanOrEqual(51.508)
  })

  it('returns real polygon geometry for the seeded industrial estate', async () => {
    const out = await searchAssets('type:industrial near:london')
    expect(isSearchError(out)).toBe(false)
    if (isSearchError(out)) return
    const poly = out.results.find((a) => a.name?.includes('Isle of Dogs'))
    expect(poly).toBeTruthy()
    expect(poly!.geometry?.type).toBe('Polygon')
    const [centroid] = await sql<{ lat: number; lon: number }[]>`
      SELECT ST_Y(centroid::geometry) AS lat, ST_X(centroid::geometry) AS lon
      FROM assets
      WHERE osm_id = 9100000002
    `
    expect(Number(poly!.lat)).toBe(Number(centroid.lat))
    expect(Number(poly!.lon)).toBe(Number(centroid.lon))
    expect(out.bounds).toBeTruthy()
    expect(out.bounds![0]).toBeLessThanOrEqual(-0.02)
    expect(out.bounds![1]).toBeLessThanOrEqual(51.5)
    expect(out.bounds![2]).toBeGreaterThanOrEqual(-0.01)
    expect(out.bounds![3]).toBeGreaterThanOrEqual(51.505)
  })

  it('includes a pipeline that intersects Texas even when the centroid is outside', async () => {
    try {
      await sql`
        INSERT INTO assets (osm_type, osm_id, name, canonical_type, geom, tags) VALUES (
          'way',
          9199990001,
          'West Texas Spur',
          'pipeline',
          ST_SetSRID(ST_GeomFromText('LINESTRING(-120 32, -106.5 32)'), 4326),
          '{"man_made":"pipeline"}'::jsonb
        )
        ON CONFLICT (osm_type, osm_id) DO UPDATE SET
          name = EXCLUDED.name,
          canonical_type = EXCLUDED.canonical_type,
          geom = EXCLUDED.geom,
          tags = EXCLUDED.tags
      `
      const out = await searchAssets('pipelines in texas')
      expect(isSearchError(out)).toBe(false)
      if (isSearchError(out)) return
      const spur = out.results.find((a) => a.name === 'West Texas Spur')
      expect(spur).toBeTruthy()
      expect(spur!.geometry?.type).toBe('LineString')
      expect(spur!.lon).toBeLessThan(-106.646)
    } finally {
      await sql`DELETE FROM assets WHERE osm_id = 9199990001`
    }
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

  it('resolves Georgia the US region separately from Georgia the country', async () => {
    try {
      await sql`
        INSERT INTO places (name, aliases, kind, geom, bbox) VALUES
          ('Georgia', ARRAY['sakartvelo']::text[], 'country',
            ST_SetSRID(ST_MakePoint(43.3569, 42.3154), 4326)::geography,
            ST_MakeEnvelope(40.0, 41.0, 46.7, 43.6, 4326)),
          ('Georgia', ARRAY['ga', 'georgia us']::text[], 'region',
            ST_SetSRID(ST_MakePoint(-83.5000, 32.6500), 4326)::geography,
            ST_MakeEnvelope(-85.6, 30.3, -80.8, 35.0, 4326))
        ON CONFLICT ((lower(name)), kind) DO UPDATE SET
          aliases = EXCLUDED.aliases,
          kind = EXCLUDED.kind,
          geom = EXCLUDED.geom,
          bbox = EXCLUDED.bbox
      `
      await sql`
        INSERT INTO assets (osm_type, osm_id, name, canonical_type, geom, tags) VALUES (
          'node',
          9290010001,
          'Test Georgia Airport',
          'airport',
          ST_SetSRID(ST_MakePoint(-83.4, 32.1), 4326),
          '{}'::jsonb
        )
        ON CONFLICT (osm_type, osm_id) DO UPDATE SET
          name = EXCLUDED.name,
          canonical_type = EXCLUDED.canonical_type,
          geom = EXCLUDED.geom,
          tags = EXCLUDED.tags
      `
      const region = await searchAssets('airports in georgia')
      expect(isSearchError(region)).toBe(false)
      if (isSearchError(region)) return
      expect(region.place?.kind).toBe('region')
      expect(region.place?.name).toMatch(/georgia/i)
      expect(region.results.some((a) => a.osmId === 9290010001)).toBe(true)

      const country = await searchAssets('type:airport country:georgia')
      expect(isSearchError(country)).toBe(false)
      if (isSearchError(country)) return
      expect(country.place?.kind).toBe('country')
      expect(country.place?.name).toMatch(/georgia/i)
    } finally {
      await sql`DELETE FROM assets WHERE osm_id = 9290010001`
      await sql`DELETE FROM places WHERE lower(name) = 'georgia'`
    }
  })

  it('intersects in-search against the real country shape, not a dateline envelope', async () => {
    try {
      await sql`
        INSERT INTO places (name, aliases, kind, geom, bbox) VALUES (
          'Aleutia',
          ARRAY['aleutia test']::text[],
          'country',
          ST_SetSRID(ST_MakePoint(170.0, 50.0), 4326)::geography,
          ST_Multi(ST_Union(
            ST_MakeEnvelope(169.5, 49.5, 171.0, 51.0, 4326),
            ST_MakeEnvelope(-166.0, 49.5, -164.0, 51.0, 4326)
          ))
        )
        ON CONFLICT ((lower(name)), kind) DO UPDATE SET
          aliases = EXCLUDED.aliases,
          kind = EXCLUDED.kind,
          geom = EXCLUDED.geom,
          bbox = EXCLUDED.bbox
      `
      await sql`
        INSERT INTO assets (osm_type, osm_id, name, canonical_type, geom, tags) VALUES
          (
            'node',
            9290010002,
            'Test Aleutia Airport',
            'airport',
            ST_SetSRID(ST_MakePoint(170.2, 50.1), 4326),
            '{}'::jsonb
          ),
          (
            'node',
            9290010004,
            'Test Aleutia Gap Airport',
            'airport',
            ST_SetSRID(ST_MakePoint(0, 50), 4326),
            '{}'::jsonb
          )
        ON CONFLICT (osm_type, osm_id) DO UPDATE SET
          name = EXCLUDED.name,
          canonical_type = EXCLUDED.canonical_type,
          geom = EXCLUDED.geom,
          tags = EXCLUDED.tags
      `
      const out = await searchAssets('airports in aleutia')
      expect(isSearchError(out)).toBe(false)
      if (isSearchError(out)) return
      expect(out.place?.name).toMatch(/aleutia/i)
      expect(out.results.some((a) => a.osmId === 9290010002)).toBe(true)
      expect(out.results.some((a) => a.osmId === 9290010004)).toBe(false)
    } finally {
      await sql`DELETE FROM assets WHERE osm_id IN (9290010002, 9290010004)`
      await sql`DELETE FROM places WHERE lower(name) = 'aleutia'`
    }
  })

  it('does not store a near-world envelope for a dateline-crossing way', async () => {
    try {
      await sql`
        INSERT INTO assets (osm_type, osm_id, name, canonical_type, geom, tags) VALUES (
          'way',
          9290010003,
          'Dateline Test Way',
          'pipeline',
          ST_SetSRID(ST_GeomFromText('LINESTRING(179 0, -179 0)'), 4326),
          '{}'::jsonb
        )
        ON CONFLICT (osm_type, osm_id) DO UPDATE SET
          name = EXCLUDED.name,
          canonical_type = EXCLUDED.canonical_type,
          geom = EXCLUDED.geom,
          tags = EXCLUDED.tags
      `
      await sql`
        INSERT INTO places (name, aliases, kind, geom, bbox) VALUES (
          'DatelinePin',
          ARRAY['dateline pin']::text[],
          'city',
          ST_SetSRID(ST_MakePoint(180, 0), 4326)::geography,
          ST_MakeEnvelope(178, -1, 180, 1, 4326)
        )
        ON CONFLICT ((lower(name)), kind) DO UPDATE SET
          aliases = EXCLUDED.aliases,
          kind = EXCLUDED.kind,
          geom = EXCLUDED.geom,
          bbox = EXCLUDED.bbox
      `
      const [row] = await sql<{ span: number; xmid: number; ymid: number; lat: number; lon: number }[]>`
        SELECT
          ST_XMax(bbox) - ST_XMin(bbox) AS span,
          (ST_XMin(bbox) + ST_XMax(bbox)) / 2 AS xmid,
          (ST_YMin(bbox) + ST_YMax(bbox)) / 2 AS ymid,
          ST_Y(centroid::geometry) AS lat,
          ST_X(centroid::geometry) AS lon
        FROM assets
        WHERE osm_id = 9290010003
      `
      expect(Number(row.span)).toBeLessThan(0.01)
      expect(Math.abs(Number(row.xmid))).toBeGreaterThan(170)
      expect(Math.abs(Number(row.ymid))).toBeCloseTo(0, 5)
      expect(Math.abs(Number(row.lon))).toBeGreaterThan(170)
      expect(Math.abs(Number(row.lat))).toBeCloseTo(0, 5)

      const out = await searchAssets('pipelines near datelinepin')
      expect(isSearchError(out)).toBe(false)
      if (isSearchError(out)) return
      expect(out.results.some((a) => a.osmId === 9290010003)).toBe(true)
      expect(out.bounds).toBeTruthy()
      expect(out.bounds![2] - out.bounds![0]).toBeLessThan(2)
    } finally {
      await sql`DELETE FROM assets WHERE osm_id = 9290010003`
      await sql`DELETE FROM places WHERE lower(name) = 'datelinepin'`
    }
  })

  it('keeps a tight envelope for a non-dateline way', async () => {
    try {
      await sql`
        INSERT INTO assets (osm_type, osm_id, name, canonical_type, geom, tags) VALUES (
          'way',
          9290010005,
          'London Test Way',
          'pipeline',
          ST_SetSRID(ST_GeomFromText('LINESTRING(-0.14 51.50, -0.08 51.50)'), 4326),
          '{}'::jsonb
        )
        ON CONFLICT (osm_type, osm_id) DO UPDATE SET
          name = EXCLUDED.name,
          canonical_type = EXCLUDED.canonical_type,
          geom = EXCLUDED.geom,
          tags = EXCLUDED.tags
      `
      const [row] = await sql<{ span: number }[]>`
        SELECT ST_XMax(bbox) - ST_XMin(bbox) AS span
        FROM assets
        WHERE osm_id = 9290010005
      `
      expect(Number(row.span)).toBeGreaterThan(0.01)
      expect(Number(row.span)).toBeLessThan(1)
    } finally {
      await sql`DELETE FROM assets WHERE osm_id = 9290010005`
    }
  })

  it('keeps the larger bbox on same name and kind conflict', async () => {
    try {
      await sql`
        INSERT INTO places (name, aliases, kind, geom, bbox) VALUES (
          'Washland',
          ARRAY['washland test']::text[],
          'region',
          ST_SetSRID(ST_MakePoint(0.05, 0.05), 4326)::geography,
          ST_MakeEnvelope(0, 0, 0.1, 0.1, 4326)
        )
        ON CONFLICT ((lower(name)), kind) DO UPDATE SET
          bbox = EXCLUDED.bbox
          WHERE ST_Area(EXCLUDED.bbox::geography) > ST_Area(places.bbox::geography)
      `
      await sql`
        INSERT INTO places (name, aliases, kind, geom, bbox) VALUES (
          'Washland',
          ARRAY['washland test']::text[],
          'region',
          ST_SetSRID(ST_MakePoint(0, 0), 4326)::geography,
          ST_MakeEnvelope(-10, -10, 20, 15, 4326)
        )
        ON CONFLICT ((lower(name)), kind) DO UPDATE SET
          bbox = EXCLUDED.bbox
          WHERE ST_Area(EXCLUDED.bbox::geography) > ST_Area(places.bbox::geography)
      `
      const [row] = await sql<{ xmax: number }[]>`
        SELECT ST_XMax(bbox) AS xmax
        FROM places
        WHERE lower(name) = 'washland' AND kind = 'region'
      `
      expect(Number(row.xmax)).toBeGreaterThanOrEqual(20)

      await sql`
        INSERT INTO places (name, aliases, kind, geom, bbox) VALUES (
          'Washland',
          ARRAY['washland test']::text[],
          'region',
          ST_SetSRID(ST_MakePoint(0.05, 0.05), 4326)::geography,
          ST_MakeEnvelope(0, 0, 0.1, 0.1, 4326)
        )
        ON CONFLICT ((lower(name)), kind) DO UPDATE SET
          bbox = EXCLUDED.bbox
          WHERE ST_Area(EXCLUDED.bbox::geography) > ST_Area(places.bbox::geography)
      `
      const [kept] = await sql<{ xmax: number }[]>`
        SELECT ST_XMax(bbox) AS xmax
        FROM places
        WHERE lower(name) = 'washland' AND kind = 'region'
      `
      expect(Number(kept.xmax)).toBeGreaterThanOrEqual(20)
    } finally {
      await sql`DELETE FROM places WHERE lower(name) = 'washland'`
    }
  })

  it('stores a tiny polygon bbox for a point asset', async () => {
    try {
      await sql`
        INSERT INTO assets (osm_type, osm_id, name, canonical_type, geom, tags) VALUES (
          'node',
          9290010006,
          'Point Bbox Pin',
          'airport',
          ST_SetSRID(ST_MakePoint(-0.1, 51.5), 4326),
          '{}'::jsonb
        )
        ON CONFLICT (osm_type, osm_id) DO UPDATE SET
          name = EXCLUDED.name,
          canonical_type = EXCLUDED.canonical_type,
          geom = EXCLUDED.geom,
          tags = EXCLUDED.tags
      `
      const [row] = await sql<{ gtype: string; xspan: number; yspan: number }[]>`
        SELECT
          GeometryType(bbox) AS gtype,
          ST_XMax(bbox) - ST_XMin(bbox) AS xspan,
          ST_YMax(bbox) - ST_YMin(bbox) AS yspan
        FROM assets
        WHERE osm_id = 9290010006
      `
      expect(['POLYGON', 'ST_Polygon']).toContain(row.gtype)
      expect(Number(row.xspan)).toBeGreaterThan(0)
      expect(Number(row.xspan)).toBeLessThan(1e-6)
      expect(Number(row.yspan)).toBeGreaterThan(0)
      expect(Number(row.yspan)).toBeLessThan(1e-6)
    } finally {
      await sql`DELETE FROM assets WHERE osm_id = 9290010006`
    }
  })

  it('overwrite upsert replaces a larger bbox with a smaller one', async () => {
    try {
      await sql`
        INSERT INTO places (name, aliases, kind, geom, bbox) VALUES (
          'Overwriteland',
          ARRAY['overwriteland test']::text[],
          'country',
          ST_SetSRID(ST_MakePoint(0, 0), 4326)::geography,
          ST_MakeEnvelope(-10, -10, 20, 15, 4326)
        )
        ON CONFLICT ((lower(name)), kind) DO UPDATE SET
          aliases = EXCLUDED.aliases,
          kind = EXCLUDED.kind,
          geom = EXCLUDED.geom,
          bbox = EXCLUDED.bbox
      `
      await sql`
        INSERT INTO places (name, aliases, kind, geom, bbox) VALUES (
          'Overwriteland',
          ARRAY['overwriteland test']::text[],
          'country',
          ST_SetSRID(ST_MakePoint(0.05, 0.05), 4326)::geography,
          ST_MakeEnvelope(0, 0, 0.1, 0.1, 4326)
        )
        ON CONFLICT ((lower(name)), kind) DO UPDATE SET
          aliases = EXCLUDED.aliases,
          kind = EXCLUDED.kind,
          geom = EXCLUDED.geom,
          bbox = EXCLUDED.bbox
      `
      const [row] = await sql<{ xmax: number }[]>`
        SELECT ST_XMax(bbox) AS xmax
        FROM places
        WHERE lower(name) = 'overwriteland' AND kind = 'country'
      `
      expect(Number(row.xmax)).toBeCloseTo(0.1, 6)
    } finally {
      await sql`DELETE FROM places WHERE lower(name) = 'overwriteland'`
    }
  })
})

describe('searchAssets — spatial join hops', () => {
  it('finds the Thames pipeline within 30 km of airports near london', async () => {
    const out = await searchAssets('pipelines within 30 km of airports near london')
    expect(isSearchError(out)).toBe(false)
    if (isSearchError(out)) return
    const pipe = out.results.find((a) => a.name?.includes('Thames'))
    expect(pipe).toBeTruthy()
    expect(pipe!.geometry?.type).toBe('LineString')
    expect(out.related).toHaveLength(1)
    expect(out.related[0]!.type).toBe('airport')
    expect(out.related[0]!.assets.length).toBeGreaterThanOrEqual(1)
    expect(out.related[0]!.assets.every((a) => a.type === 'airport')).toBe(true)
  })

  it('finds Isle of Dogs industrial within 20 km of pipelines near london', async () => {
    const out = await searchAssets('industrial within 20 km of pipelines near london')
    expect(isSearchError(out)).toBe(false)
    if (isSearchError(out)) return
    const poly = out.results.find((a) => a.name?.includes('Isle of Dogs'))
    expect(poly).toBeTruthy()
    expect(poly!.geometry?.type).toBe('Polygon')
    expect(out.related[0]!.type).toBe('pipeline')
    const pipe = out.related[0]!.assets.find((a) => a.name?.includes('Thames'))
    expect(pipe).toBeTruthy()
    expect(pipe!.geometry?.type).toBe('LineString')
  })

  it('does not treat airports near london within 20 km as a join', async () => {
    const out = await searchAssets('airports near london within 20 km')
    expect(isSearchError(out)).toBe(false)
    if (isSearchError(out)) return
    expect(out.query.hops).toEqual([])
    expect(out.query.radius).toBe(20)
    expect(out.related).toEqual([])
    expect(out.results.length).toBeGreaterThan(0)
    expect(out.results.every((a) => a.type === 'airport')).toBe(true)
  })

  it('returns empty subject without throwing when a join cannot match', async () => {
    const out = await searchAssets('pipelines within 1 km of telecom near london')
    expect(isSearchError(out)).toBe(false)
    if (isSearchError(out)) return
    expect(out.results).toEqual([])
    expect(out.stats.total).toBe(0)
    expect(out.related).toEqual([{ type: 'telecom', withinM: 1000, assets: [] }])
    expect(out.bounds).toBeNull()
  })

  it('finds industrial within 20 km of pipelines within 50 km of airports near london', async () => {
    const out = await searchAssets(
      'industrial within 20 km of pipelines within 50 km of airports near london',
    )
    expect(isSearchError(out)).toBe(false)
    if (isSearchError(out)) return
    const poly = out.results.find((a) => a.name?.includes('Isle of Dogs'))
    expect(poly).toBeTruthy()
    expect(poly!.geometry?.type).toBe('Polygon')
    expect(out.related).toHaveLength(2)
    expect(out.related[0]!.type).toBe('pipeline')
    const pipe = out.related[0]!.assets.find((a) => a.name?.includes('Thames'))
    expect(pipe).toBeTruthy()
    expect(pipe!.geometry?.type).toBe('LineString')
    expect(out.related[1]!.type).toBe('airport')
    expect(out.related[1]!.assets.length).toBeGreaterThanOrEqual(1)
  })

  it('does not self-match same-type joins', async () => {
    try {
      await sql`
        INSERT INTO assets (osm_type, osm_id, name, canonical_type, geom, tags) VALUES (
          'node',
          9290010006,
          'Test Texas Airport',
          'airport',
          ST_SetSRID(ST_MakePoint(-99.0, 32.0), 4326),
          '{}'::jsonb
        )
        ON CONFLICT (osm_type, osm_id) DO UPDATE SET
          name = EXCLUDED.name,
          canonical_type = EXCLUDED.canonical_type,
          geom = EXCLUDED.geom,
          tags = EXCLUDED.tags
      `
      const out = await searchAssets('airports within 10 km of airports in texas')
      expect(isSearchError(out)).toBe(false)
      if (isSearchError(out)) return
      expect(out.results).toEqual([])
      expect(out.stats.total).toBe(0)
    } finally {
      await sql`DELETE FROM assets WHERE osm_id = 9290010006`
    }
  })
})
