import { sql } from './client'
import { parseQuery, validateQuery } from '../domain/parser'
import type { Asset, SearchError, SearchResult } from '../domain/types'

const RESULT_CAP = 500

type PlaceRow = {
  id: number
  name: string
  kind: string
  lat: number
  lon: number
}

type AssetRow = {
  id: number
  osm_type: string
  osm_id: number
  name: string | null
  canonical_type: string
  operator: string | null
  lat: number
  lon: number
  tags: Record<string, unknown>
}

function asTags(tags: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(tags ?? {})) {
    if (v == null) continue
    out[k] = String(v)
  }
  return out
}

function toAsset(row: AssetRow): Asset {
  return {
    id: `${row.osm_type}/${row.osm_id}`,
    osmType: row.osm_type,
    osmId: Number(row.osm_id),
    name: row.name,
    type: row.canonical_type,
    operator: row.operator,
    lat: Number(row.lat),
    lon: Number(row.lon),
    tags: asTags(row.tags),
  }
}

async function resolvePlace(
  name: string,
  preferKind?: string | null,
): Promise<PlaceRow | null> {
  const rows = await sql<PlaceRow[]>`
    SELECT
      id,
      name,
      kind,
      ST_Y(geom::geometry) AS lat,
      ST_X(geom::geometry) AS lon
    FROM places
    WHERE lower(name) = lower(${name})
       OR EXISTS (
         SELECT 1 FROM unnest(aliases) AS a WHERE lower(a) = lower(${name})
       )
    ORDER BY
      CASE WHEN lower(name) = lower(${name}) THEN 0 ELSE 1 END,
      CASE
        WHEN kind = ${preferKind ?? ''} THEN 0
        WHEN kind = 'city' THEN 1
        WHEN kind = 'region' THEN 2
        ELSE 3
      END
    LIMIT 1
  `
  return rows[0] ?? null
}

export async function searchAssets(q: string): Promise<SearchResult | SearchError> {
  const query = parseQuery(q)
  const validity = validateQuery(query)
  if (!validity.valid) {
    return { error: validity.error ?? 'Invalid query', code: 'invalid_query', query }
  }

  const placeName = query.near ?? query.region ?? query.country
  const preferKind = query.country
    ? 'country'
    : query.near
      ? 'city'
      : query.region
        ? 'region'
        : null
  const place = placeName ? await resolvePlace(placeName, preferKind) : null
  if (!place) {
    return {
      error: `Unknown place "${placeName ?? ''}". Seeded places include London, New York, Karnataka, Mumbai, France, California, Germany, India.`,
      code: 'unknown_place',
      query,
    }
  }

  const type = query.type
  const operator = query.operator
  const useNear = Boolean(query.near)
  const radiusM = query.radius * 1000
  const typeFilter = type ? sql`AND a.canonical_type = ${type}` : sql``
  const operatorFilter = operator
    ? sql`AND a.operator ILIKE ${'%' + operator + '%'}`
    : sql``
  const geoFilter = useNear
    ? sql`AND ST_DWithin(a.geom, (SELECT geom FROM places WHERE id = ${place.id}), ${radiusM})`
    : sql`AND ST_Intersects(a.geom::geometry, (SELECT bbox FROM places WHERE id = ${place.id}))`

  const [countRow] = await sql<[{ n: number }]>`
    SELECT count(*)::int AS n
    FROM assets a
    WHERE 1=1
      ${typeFilter}
      ${operatorFilter}
      ${geoFilter}
  `

  const typeRows = await sql<{ canonical_type: string; n: number }[]>`
    SELECT a.canonical_type, count(*)::int AS n
    FROM assets a
    WHERE 1=1
      ${typeFilter}
      ${operatorFilter}
      ${geoFilter}
    GROUP BY a.canonical_type
    ORDER BY n DESC
  `

  const operatorRows = await sql<{ operator: string; n: number }[]>`
    SELECT coalesce(nullif(btrim(a.operator), ''), 'Unknown') AS operator, count(*)::int AS n
    FROM assets a
    WHERE 1=1
      ${typeFilter}
      ${operatorFilter}
      ${geoFilter}
    GROUP BY 1
    ORDER BY n DESC
    LIMIT 40
  `

  const rows = await sql<AssetRow[]>`
    SELECT
      a.id,
      a.osm_type,
      a.osm_id,
      a.name,
      a.canonical_type,
      a.operator,
      ST_Y(a.geom::geometry) AS lat,
      ST_X(a.geom::geometry) AS lon,
      a.tags
    FROM assets a
    WHERE 1=1
      ${typeFilter}
      ${operatorFilter}
      ${geoFilter}
    ORDER BY a.name NULLS LAST, a.id
    LIMIT ${RESULT_CAP}
  `

  const types: Record<string, number> = {}
  for (const row of typeRows) types[row.canonical_type] = Number(row.n)
  const operators: Record<string, number> = {}
  for (const row of operatorRows) operators[row.operator] = Number(row.n)

  let bounds: [number, number, number, number] | null = null
  if (rows.length > 0) {
    let minLon = Infinity
    let minLat = Infinity
    let maxLon = -Infinity
    let maxLat = -Infinity
    for (const row of rows) {
      minLon = Math.min(minLon, Number(row.lon))
      minLat = Math.min(minLat, Number(row.lat))
      maxLon = Math.max(maxLon, Number(row.lon))
      maxLat = Math.max(maxLat, Number(row.lat))
    }
    bounds = [minLon, minLat, maxLon, maxLat]
  }

  return {
    results: rows.map(toAsset),
    stats: { total: Number(countRow?.n ?? 0), types, operators },
    bounds,
    query,
    place: {
      name: place.name,
      kind: place.kind,
      lat: Number(place.lat),
      lon: Number(place.lon),
    },
  }
}
