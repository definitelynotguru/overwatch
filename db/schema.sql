-- Overwatch schema: places + assets in PostGIS 4326
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS places (
  id          serial PRIMARY KEY,
  name        text NOT NULL,
  aliases     text[] NOT NULL DEFAULT '{}',
  kind        text NOT NULL CHECK (kind IN ('city', 'region', 'country')),
  geom        geography(Point, 4326) NOT NULL,
  bbox        geometry(Polygon, 4326) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS places_name_lower_uidx ON places (lower(name));
CREATE INDEX IF NOT EXISTS places_geom_gix ON places USING GIST (geom);
CREATE INDEX IF NOT EXISTS places_bbox_gix ON places USING GIST (bbox);

CREATE TABLE IF NOT EXISTS assets (
  id              bigserial PRIMARY KEY,
  osm_type        text NOT NULL CHECK (osm_type IN ('node', 'way', 'relation')),
  osm_id          bigint NOT NULL,
  name            text,
  canonical_type  text NOT NULL,
  operator        text,
  geom            geography(Point, 4326) NOT NULL,
  tags            jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (osm_type, osm_id)
);

CREATE INDEX IF NOT EXISTS assets_geom_gix ON assets USING GIST (geom);
CREATE INDEX IF NOT EXISTS assets_type_idx ON assets (canonical_type);
CREATE INDEX IF NOT EXISTS assets_operator_idx ON assets (operator);
