# Overwatch

Geospatial infrastructure search. PostGIS data plane, MapLibre + OpenFreeMap map, TanStack Start app.

Queries: `airports near london`, `bridges in new york`, `telecom towers in karnataka`, or `type:airport near:london radius:50`.

## Requirements

- Node 22.12 or newer
- Docker Compose (Postgres 16 + PostGIS)

## Run

```bash
docker compose up -d postgres
docker compose exec postgres pg_isready -U overwatch -d overwatch
npm run db:seed
cp .env.example .env
npm install
npm test
npm run dev
```

Open http://localhost:3000. URL q= is the source of truth. Share copies the URL.

## Build

```bash
npm run build
npm start
```

Then GET /api/search?q=airports%20near%20london

## Tests

npm test runs parser unit tests and PostGIS search tests against the seed.

## Optional import

Do not fetch planet files in CI. Tests use seed SQL. If you already have a Geofabrik extract:

```bash
./scripts/import-pbf.sh /path/to/region-latest.osm.pbf
```

Needs osmium-tool. Classifies points with the typed catalog and upserts into assets.

## Map attribution

Basemap: OpenFreeMap / OpenMapTiles. Data (c) OpenStreetMap contributors.

## Stack

- TanStack Start (Vite + React + TanStack Router + Query)
- Postgres 16 + PostGIS
- MapLibre GL JS with GeoJSON clustering
- postgres.js, parameterized SQL only
