-- Overwatch schema: places + mixed-geometry assets in PostGIS 4326
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
  geom            geometry(Geometry, 4326) NOT NULL,
  centroid        geography(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_Centroid(geom), 4326)::geography) STORED,
  bbox            geometry(Polygon, 4326) GENERATED ALWAYS AS (
                    ST_MakeEnvelope(
                      ST_XMin(geom),
                      ST_YMin(geom),
                      GREATEST(ST_XMax(geom), ST_XMin(geom) + 1e-8),
                      GREATEST(ST_YMax(geom), ST_YMin(geom) + 1e-8),
                      4326
                    )
                  ) STORED,
  tags            jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (osm_type, osm_id)
);

CREATE INDEX IF NOT EXISTS assets_geom_gix ON assets USING GIST (geom);
CREATE INDEX IF NOT EXISTS assets_geom_geog_gix ON assets USING GIST ((geom::geography));
CREATE INDEX IF NOT EXISTS assets_centroid_gix ON assets USING GIST (centroid);
CREATE INDEX IF NOT EXISTS assets_bbox_gix ON assets USING GIST (bbox);
CREATE INDEX IF NOT EXISTS assets_type_idx ON assets (canonical_type);
CREATE INDEX IF NOT EXISTS assets_operator_idx ON assets (operator);
