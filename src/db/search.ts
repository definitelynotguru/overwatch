import { sql } from './client'
import { parseQuery, validateQuery } from '../domain/parser'
import type { Asset, AssetGeometry, JoinHop, RelatedAssets, SearchError, SearchResult } from '../domain/types'

const RESULT_CAP = 500
const RELATED_CAP = 200

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
  geojson: string | null
  xmin: number
  ymin: number
  xmax: number
  ymax: number
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

function parseGeometry(raw: string | null, lat: number, lon: number): AssetGeometry {
  if (raw) {
    try {
      const g = JSON.parse(raw) as AssetGeometry
      if (g && typeof g.type === 'string') return g
    } catch {
      // fall through to centroid point
    }
  }
  return { type: 'Point', coordinates: [lon, lat] }
}

function toAsset(row: AssetRow): Asset {
  const lat = Number(row.lat)
  const lon = Number(row.lon)
  return {
    id: `${row.osm_type}/${row.osm_id}`,
    osmType: row.osm_type,
    osmId: Number(row.osm_id),
    name: row.name,
    type: row.canonical_type,
    operator: row.operator,
    lat,
    lon,
    geometry: parseGeometry(row.geojson, lat, lon),
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

function placeNear(alias: 'a' | 'h0' | 'h1' | 'h2', placeId: number, radiusM: number) {
  if (alias === 'a') {
    return sql`AND ST_DWithin(a.geom::geography, (SELECT geom FROM places WHERE id = ${placeId}), ${radiusM})`
  }
  if (alias === 'h0') {
    return sql`AND ST_DWithin(h0.geom::geography, (SELECT geom FROM places WHERE id = ${placeId}), ${radiusM})`
  }
  if (alias === 'h1') {
    return sql`AND ST_DWithin(h1.geom::geography, (SELECT geom FROM places WHERE id = ${placeId}), ${radiusM})`
  }
  return sql`AND ST_DWithin(h2.geom::geography, (SELECT geom FROM places WHERE id = ${placeId}), ${radiusM})`
}

function placeIntersects(alias: 'a' | 'h0' | 'h1' | 'h2', placeId: number) {
  if (alias === 'a') {
    return sql`AND ST_Intersects(a.geom, (SELECT bbox FROM places WHERE id = ${placeId}))`
  }
  if (alias === 'h0') {
    return sql`AND ST_Intersects(h0.geom, (SELECT bbox FROM places WHERE id = ${placeId}))`
  }
  if (alias === 'h1') {
    return sql`AND ST_Intersects(h1.geom, (SELECT bbox FROM places WHERE id = ${placeId}))`
  }
  return sql`AND ST_Intersects(h2.geom, (SELECT bbox FROM places WHERE id = ${placeId}))`
}

function placeOn(alias: 'a' | 'h0' | 'h1' | 'h2', placeId: number, useNear: boolean, radiusM: number) {
  return useNear ? placeNear(alias, placeId, radiusM) : placeIntersects(alias, placeId)
}

function subjectJoinSql(hops: JoinHop[], placeId: number, useNear: boolean, radiusM: number) {
  const p0 = hops[0]!
  if (hops.length === 1) {
    return sql`
      AND EXISTS (
        SELECT 1 FROM assets h0
        WHERE h0.canonical_type = ${p0.type}
          AND h0.id <> a.id
          AND ST_DWithin(a.geom::geography, h0.geom::geography, ${p0.withinM})
          ${placeOn('h0', placeId, useNear, radiusM)}
      )`
  }
  const p1 = hops[1]!
  if (hops.length === 2) {
    return sql`
      AND EXISTS (
        SELECT 1 FROM assets h0
        WHERE h0.canonical_type = ${p0.type}
          AND h0.id <> a.id
          AND ST_DWithin(a.geom::geography, h0.geom::geography, ${p0.withinM})
          AND EXISTS (
            SELECT 1 FROM assets h1
            WHERE h1.canonical_type = ${p1.type}
              AND h1.id <> h0.id
              AND ST_DWithin(h0.geom::geography, h1.geom::geography, ${p1.withinM})
              ${placeOn('h1', placeId, useNear, radiusM)}
          )
      )`
  }
  const p2 = hops[2]!
  return sql`
    AND EXISTS (
      SELECT 1 FROM assets h0
      WHERE h0.canonical_type = ${p0.type}
        AND h0.id <> a.id
        AND ST_DWithin(a.geom::geography, h0.geom::geography, ${p0.withinM})
        AND EXISTS (
          SELECT 1 FROM assets h1
          WHERE h1.canonical_type = ${p1.type}
            AND h1.id <> h0.id
            AND ST_DWithin(h0.geom::geography, h1.geom::geography, ${p1.withinM})
            AND EXISTS (
              SELECT 1 FROM assets h2
              WHERE h2.canonical_type = ${p2.type}
                AND h2.id <> h1.id
                AND ST_DWithin(h1.geom::geography, h2.geom::geography, ${p2.withinM})
                ${placeOn('h2', placeId, useNear, radiusM)}
            )
        )
    )`
}

function relatedWhere(
  hopIndex: number,
  hops: JoinHop[],
  subjectIds: number[],
  placeId: number,
  useNear: boolean,
  radiusM: number,
) {
  const n = hops.length
  const p0 = hops[0]!
  if (n === 1) {
    return sql`
      AND a.canonical_type = ${p0.type}
      AND EXISTS (
        SELECT 1 FROM assets s
        WHERE s.id = ANY(${subjectIds})
          AND a.id <> s.id
          AND ST_DWithin(s.geom::geography, a.geom::geography, ${p0.withinM})
      )
      ${placeOn('a', placeId, useNear, radiusM)}`
  }
  const p1 = hops[1]!
  if (n === 2) {
    if (hopIndex === 0) {
      return sql`
        AND a.canonical_type = ${p0.type}
        AND EXISTS (
          SELECT 1 FROM assets s
          WHERE s.id = ANY(${subjectIds})
            AND a.id <> s.id
            AND ST_DWithin(s.geom::geography, a.geom::geography, ${p0.withinM})
        )
        AND EXISTS (
          SELECT 1 FROM assets h1
          WHERE h1.canonical_type = ${p1.type}
            AND h1.id <> a.id
            AND ST_DWithin(a.geom::geography, h1.geom::geography, ${p1.withinM})
            ${placeOn('h1', placeId, useNear, radiusM)}
        )`
    }
    return sql`
      AND a.canonical_type = ${p1.type}
      ${placeOn('a', placeId, useNear, radiusM)}
      AND EXISTS (
        SELECT 1 FROM assets h0
        WHERE h0.canonical_type = ${p0.type}
          AND a.id <> h0.id
          AND ST_DWithin(h0.geom::geography, a.geom::geography, ${p1.withinM})
          AND EXISTS (
            SELECT 1 FROM assets s
            WHERE s.id = ANY(${subjectIds})
              AND h0.id <> s.id
              AND ST_DWithin(s.geom::geography, h0.geom::geography, ${p0.withinM})
          )
      )`
  }
  const p2 = hops[2]!
  if (hopIndex === 0) {
    return sql`
      AND a.canonical_type = ${p0.type}
      AND EXISTS (
        SELECT 1 FROM assets s
        WHERE s.id = ANY(${subjectIds})
          AND a.id <> s.id
          AND ST_DWithin(s.geom::geography, a.geom::geography, ${p0.withinM})
      )
      AND EXISTS (
        SELECT 1 FROM assets h1
        WHERE h1.canonical_type = ${p1.type}
          AND h1.id <> a.id
          AND ST_DWithin(a.geom::geography, h1.geom::geography, ${p1.withinM})
          AND EXISTS (
            SELECT 1 FROM assets h2
            WHERE h2.canonical_type = ${p2.type}
              AND h2.id <> h1.id
              AND ST_DWithin(h1.geom::geography, h2.geom::geography, ${p2.withinM})
              ${placeOn('h2', placeId, useNear, radiusM)}
          )
      )`
  }
  if (hopIndex === 1) {
    return sql`
      AND a.canonical_type = ${p1.type}
      AND EXISTS (
        SELECT 1 FROM assets h0
        WHERE h0.canonical_type = ${p0.type}
          AND a.id <> h0.id
          AND ST_DWithin(h0.geom::geography, a.geom::geography, ${p1.withinM})
          AND EXISTS (
            SELECT 1 FROM assets s
            WHERE s.id = ANY(${subjectIds})
              AND h0.id <> s.id
              AND ST_DWithin(s.geom::geography, h0.geom::geography, ${p0.withinM})
          )
      )
      AND EXISTS (
        SELECT 1 FROM assets h2
        WHERE h2.canonical_type = ${p2.type}
          AND h2.id <> a.id
          AND ST_DWithin(a.geom::geography, h2.geom::geography, ${p2.withinM})
          ${placeOn('h2', placeId, useNear, radiusM)}
      )`
  }
  return sql`
    AND a.canonical_type = ${p2.type}
    ${placeOn('a', placeId, useNear, radiusM)}
    AND EXISTS (
      SELECT 1 FROM assets h1
      WHERE h1.canonical_type = ${p1.type}
        AND a.id <> h1.id
        AND ST_DWithin(h1.geom::geography, a.geom::geography, ${p2.withinM})
        AND EXISTS (
          SELECT 1 FROM assets h0
          WHERE h0.canonical_type = ${p0.type}
            AND h1.id <> h0.id
            AND ST_DWithin(h0.geom::geography, h1.geom::geography, ${p1.withinM})
            AND EXISTS (
              SELECT 1 FROM assets s
              WHERE s.id = ANY(${subjectIds})
                AND h0.id <> s.id
                AND ST_DWithin(s.geom::geography, h0.geom::geography, ${p0.withinM})
            )
        )
    )`
}

function foldBounds(rowSets: AssetRow[][]): [number, number, number, number] | null {
  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity
  let any = false
  for (const rows of rowSets) {
    for (const row of rows) {
      any = true
      minLon = Math.min(minLon, Number(row.xmin))
      minLat = Math.min(minLat, Number(row.ymin))
      maxLon = Math.max(maxLon, Number(row.xmax))
      maxLat = Math.max(maxLat, Number(row.ymax))
    }
  }
  if (!any) return null
  return [minLon, minLat, maxLon, maxLat]
}

async function loadRelated(
  hops: JoinHop[],
  subjectIds: number[],
  placeId: number,
  useNear: boolean,
  radiusM: number,
): Promise<{ related: RelatedAssets[]; rows: AssetRow[][] }> {
  if (hops.length === 0) return { related: [], rows: [] }
  if (subjectIds.length === 0) {
    return {
      related: hops.map((h) => ({ type: h.type, withinM: h.withinM, assets: [] })),
      rows: hops.map(() => []),
    }
  }
  const rowSets = await Promise.all(
    hops.map((_, i) =>
      sql<AssetRow[]>`
        SELECT
          a.id,
          a.osm_type,
          a.osm_id,
          a.name,
          a.canonical_type,
          a.operator,
          ST_Y(a.centroid::geometry) AS lat,
          ST_X(a.centroid::geometry) AS lon,
          ST_AsGeoJSON(
            CASE
              WHEN GeometryType(a.geom) IN ('POINT', 'MULTIPOINT') THEN a.geom
              WHEN ST_NPoints(a.geom) > 400 THEN COALESCE(ST_SimplifyPreserveTopology(a.geom, 0.0003), a.geom)
              ELSE a.geom
            END
          ) AS geojson,
          ST_XMin(a.bbox) AS xmin,
          ST_YMin(a.bbox) AS ymin,
          ST_XMax(a.bbox) AS xmax,
          ST_YMax(a.bbox) AS ymax,
          a.tags
        FROM assets a
        WHERE 1=1
          ${relatedWhere(i, hops, subjectIds, placeId, useNear, radiusM)}
        ORDER BY a.name NULLS LAST, a.id
        LIMIT ${RELATED_CAP}
      `,
    ),
  )
  return {
    related: hops.map((h, i) => ({
      type: h.type,
      withinM: h.withinM,
      assets: rowSets[i]!.map(toAsset),
    })),
    rows: rowSets,
  }
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
      error: `Unknown place "${placeName ?? ''}". Load the Natural Earth gazetteer or seed demo places.`,
      code: 'unknown_place',
      query,
    }
  }

  const type = query.type
  const operator = query.operator
  const useNear = Boolean(query.near)
  const radiusM = query.radius * 1000
  const typeFilter = type ? sql`AND a.canonical_type = ${type}` : sql``
  const likePattern = operator
    ? '%' + operator.replace(/[\\%_]/g, '\\$&') + '%'
    : null
  const operatorFilter = likePattern
    ? sql`AND a.operator ILIKE ${likePattern} ESCAPE '\\'`
    : sql``
  const hops = query.hops
  const joinFilter =
    hops.length > 0 ? subjectJoinSql(hops, place.id, useNear, radiusM) : sql``
  const geoFilter =
    hops.length > 0
      ? sql``
      : useNear
        ? sql`AND ST_DWithin(a.geom::geography, (SELECT geom FROM places WHERE id = ${place.id}), ${radiusM})`
        : sql`AND ST_Intersects(a.geom, (SELECT bbox FROM places WHERE id = ${place.id}))`

  const [countRows, typeRows, operatorRows, rows] = await Promise.all([
    sql<[{ n: number }]>`
      SELECT count(*)::int AS n
      FROM assets a
      WHERE 1=1
        ${typeFilter}
        ${operatorFilter}
        ${geoFilter}
        ${joinFilter}
    `,
    sql<{ canonical_type: string; n: number }[]>`
      SELECT a.canonical_type, count(*)::int AS n
      FROM assets a
      WHERE 1=1
        ${typeFilter}
        ${operatorFilter}
        ${geoFilter}
        ${joinFilter}
      GROUP BY a.canonical_type
      ORDER BY n DESC
    `,
    sql<{ operator: string; n: number }[]>`
      SELECT coalesce(nullif(btrim(a.operator), ''), 'Unknown') AS operator, count(*)::int AS n
      FROM assets a
      WHERE 1=1
        ${typeFilter}
        ${operatorFilter}
        ${geoFilter}
        ${joinFilter}
      GROUP BY 1
      ORDER BY n DESC
      LIMIT 40
    `,
    sql<AssetRow[]>`
      SELECT
        a.id,
        a.osm_type,
        a.osm_id,
        a.name,
        a.canonical_type,
        a.operator,
        ST_Y(a.centroid::geometry) AS lat,
        ST_X(a.centroid::geometry) AS lon,
        ST_AsGeoJSON(
          CASE
            WHEN GeometryType(a.geom) IN ('POINT', 'MULTIPOINT') THEN a.geom
            WHEN ST_NPoints(a.geom) > 400 THEN COALESCE(ST_SimplifyPreserveTopology(a.geom, 0.0003), a.geom)
            ELSE a.geom
          END
        ) AS geojson,
        ST_XMin(a.bbox) AS xmin,
        ST_YMin(a.bbox) AS ymin,
        ST_XMax(a.bbox) AS xmax,
        ST_YMax(a.bbox) AS ymax,
        a.tags
      FROM assets a
      WHERE 1=1
        ${typeFilter}
        ${operatorFilter}
        ${geoFilter}
        ${joinFilter}
      ORDER BY a.name NULLS LAST, a.id
      LIMIT ${RESULT_CAP}
    `,
  ])
  const countRow = countRows[0]

  const types: Record<string, number> = {}
  for (const row of typeRows) types[row.canonical_type] = Number(row.n)
  const operators: Record<string, number> = {}
  for (const row of operatorRows) operators[row.operator] = Number(row.n)

  const { related, rows: relatedRows } = await loadRelated(
    hops,
    rows.map((r) => Number(r.id)),
    place.id,
    useNear,
    radiusM,
  )

  const bounds = foldBounds([rows, ...relatedRows])

  return {
    results: rows.map(toAsset),
    related,
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
