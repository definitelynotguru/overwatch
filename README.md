# Overwatch

Search physical infrastructure the way you would say it out loud.

`airports near london` · `bridges in new york` · `telecom towers in karnataka`

Overwatch is a geospatial search app. You type a place and an asset type. PostGIS answers with the stored geometry (point, line, or polygon). MapLibre draws those shapes on a dark OpenFreeMap vector basemap and clusters centroids at low zoom. There is no Overpass round trip, no Nominatim in the search path, and no Leaflet.

[![Overwatch showcase](docs/showcase.gif)](https://overwatch-ochre.vercel.app/showcase.mp4)

Live at [overwatch-ochre.vercel.app](https://overwatch-ochre.vercel.app). The cut above is also at [`/showcase.mp4`](https://overwatch-ochre.vercel.app/showcase.mp4).

![Airports near London](docs/screenshots/airports-london.png)

The seeded catalog behind those three queries:

| Query | Hits | Notable |
| --- | ---: | --- |
| `airports near london` | 49 | Heathrow is in the set |
| `bridges in new york` | 125 | Brooklyn Bridge is in the set |
| `telecom towers in karnataka` | 30 | Airtel, Jio, BSNL, Vodafone Idea |

Counts came from `curl` against a running local app. `near` uses a 50 km radius unless you override it.

## What you get

A natural-language parser and a structured `key:value` parser that both land on the same query object. SQL then runs meter ST_DWithin / ST_Intersects against mixed `geometry(Geometry, 4326)` with GIST indexes. The UI is a dark three-column layout: facets, result cards, map.

The URL is the query. `/?q=airports%20near%20london` is a shareable search. Enter submits. Escape clears.

## Gallery

![Bridges in New York](docs/screenshots/bridges-new-york.png)

![Telecom towers in Karnataka](docs/screenshots/telecom-karnataka.png)

![Empty search](docs/screenshots/home.png)

## How a search runs

```mermaid
flowchart LR
  Parser --> Place
  Place --> PostGIS
  PostGIS --> MapLibre
```

You type `q`. The parser emits a query object. Overwatch resolves the place from the `places` table, then PostGIS filters `assets` with `ST_DWithin` on `geom::geography` (`near`) or `ST_Intersects` on the real geom (`in` / `region` / `country`). The API returns GeoJSON of the stored geometry plus facets. MapLibre draws points, lines, and polygons, and clusters on the generated centroid.

`near` uses the place point and your radius in meters. `in` uses the place bbox. The old prototype hit public Overpass and timed out. This classifies assets at ingest and queries local PostGIS.

## Run it

You need Node 22.12+ and Docker Compose.

```bash
docker compose up -d postgres
npm run db:migrate
npm run db:seed
cp .env.example .env
npm install
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Postgres listens on `127.0.0.1:5432`. User, password, and database are all `overwatch`.

`docker compose` applies `db/schema.sql` on first start. `npm run db:seed` loads demo places and mixed-geometry assets.

Production:

```bash
npm run build && npm start
```

## Query language

Natural language:

```
airports near london
bridges in new york
telecom towers in karnataka
airports near london within 20 km
airtel in karnataka
pipelines within 20 km of airports near london
```

Structured tokens. Quote a value when it has spaces.

```
type:airport near:london radius:50
type:datacenter region:california
operator:airtel region:karnataka
operator:"Long Island Rail Road" region:"new york"
```

| Token | Meaning |
| --- | --- |
| `type` | Canonical asset type or an alias from the catalog (`airport`, `datacenter` → `data_center`) |
| `operator` | Substring match on `assets.operator`, case-insensitive. `%` and `_` are literals, not wildcards |
| `region` / `country` | Place name. `country` prefers a country row when resolving |
| `near` | Place name plus radius search |
| `radius` | Kilometers, 1-500. Default 50. Used only with `near` |

`within N km of <type>` is a spatial join hop (up to 3); the place filter applies only to the innermost type.

You need a type or an operator, and you need a place. Missing either returns `invalid_query`. A place missing from the places table returns `unknown_place`.

Demo places: London, New York, Karnataka, Mumbai, France, California, Germany, India, Berlin, and Texas. Aliases such as nyc and bombay resolve too. scripts/load-gazetteer.sh loads Natural Earth countries, admin-1, and populated places.

## HTTP API

```bash
curl -s "http://localhost:3000/api/search?q=airports+near+london"
```

| Status | When |
| ---: | --- |
| 200 | Hits, including `stats.total === 0` |
| 400 | `invalid_query` (no type/operator, no place, or `q` longer than 500 chars) |
| 404 | `unknown_place` |

A hit looks like this. Heathrow is in the London set.

```json
{
  "results": [
    {
      "id": "node/9000000001",
      "osmType": "node",
      "osmId": 9000000001,
      "name": "Heathrow Airport",
      "type": "airport",
      "operator": "Heathrow Airport Limited",
      "lat": 51.47,
      "lon": -0.4543,
      "tags": {
        "iata": "LHR",
        "icao": "EGLL",
        "aeroway": "aerodrome",
        "wikipedia": "en:Heathrow Airport"
      }
    }
  ],
  "stats": {
    "total": 49,
    "types": { "airport": 49 },
    "operators": { "Heathrow Airport Limited": 1 }
  },
  "bounds": [-0.51, 51.28, 0.33, 51.69],
  "query": {
    "type": "airport",
    "operator": null,
    "region": null,
    "country": null,
    "near": "london",
    "radius": 50,
    "raw": "airports near london"
  },
  "place": {
    "name": "London",
    "kind": "city",
    "lat": 51.5074,
    "lon": -0.1278
  }
}
```

`results` is capped at 500 rows. `stats.total` is the unclipped count.

## Data model

Two tables, both in EPSG 4326.

**places**

| Column | Type |
| --- | --- |
| `name` | text, unique on `lower(name)` |
| `aliases` | text[] |
| `kind` | `city` / `region` / `country` |
| `geom` | `geography(Point, 4326)`, GIST |
| `bbox` | `geometry(Polygon, 4326)`, GIST |

**assets**

| Column | Type |
| --- | --- |
| `osm_type`, `osm_id` | unique pair (`node` / `way` / `relation` + bigint) |
| `name` | text |
| `canonical_type` | text, btree |
| `operator` | text, btree |
| `geom` | `geometry(Geometry, 4326)`, source of truth, GIST |
| `centroid` | generated `geography(Point, 4326)` for pins / clusters |
| `bbox` | generated `geometry(Polygon, 4326)` for index / display |
| `tags` | jsonb |

Type ids, aliases, and OSM matchers live in [`src/domain/catalog.ts`](src/domain/catalog.ts). Ingest classifies a feature once. Search never re-reads raw OSM tags.

## Load a real extract

The seed is a demo. For a Geofabrik `.osm.pbf` you already downloaded:

```bash
./scripts/import-pbf.sh /path/to/region-latest.osm.pbf
```

That needs [osmium-tool](https://osmcode.org/osmium-tool/). It filters aeroway, man_made, power, industrial, port, and data-centre tags, exports points, linestrings, and polygons (no centroid-on-import) through `scripts/load-geojson.py`. The loader skips non-finite coordinates and anything outside WGS84 bounds. Do not fetch the planet in CI.

## Tests

Vitest runs parser unit tests and PostGIS search tests against the seed. Parser coverage includes natural language, structured tokens, quoted values, radius clamps, and operator word boundaries. Search tests check the three demo queries, non-point geometries, Berlin and Texas fixtures, `unknown_place`, `invalid_query`, operator LIKE escaping, and the 500-row cap.

## Keyboard

| Key | Action |
| --- | --- |
| Enter | Submit the search. The URL `q` param is the source of truth |
| Escape | Clear the input and the query |
| Share | Copy the current URL to the clipboard |

## Stack

| Piece | Role |
| --- | --- |
| TanStack Start | Vite, React 19, Router, Query |
| Postgres 16 + PostGIS | Places, assets, GIST filters |
| MapLibre GL JS | OpenFreeMap vector basemap, GeoJSON clusters |
| postgres.js | Parameterized SQL only |
| Vitest | Parser and search tests |

## Map attribution

Basemap: OpenFreeMap / OpenMapTiles / OSM. Vector style from OpenFreeMap (https://openfreemap.org) and OpenMapTiles (https://www.openmaptiles.org). Data (c) OpenStreetMap contributors (https://www.openstreetmap.org/copyright).
