-- Overwatch schema: places + mixed-geometry assets in PostGIS 4326
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE OR REPLACE FUNCTION overwatch_asset_bbox(g geometry)
RETURNS geometry
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT CASE
    WHEN ST_XMax(g) - ST_XMin(g) > 180 THEN
      ST_MakeEnvelope(
        ST_X(c) - 1e-4,
        ST_Y(c) - 1e-4,
        ST_X(c) + 1e-4,
        ST_Y(c) + 1e-4,
        4326
      )
    ELSE
      ST_MakeEnvelope(
        ST_XMin(g),
        ST_YMin(g),
        GREATEST(ST_XMax(g), ST_XMin(g) + 1e-8),
        GREATEST(ST_YMax(g), ST_YMin(g) + 1e-8),
        4326
      )
  END
  FROM (SELECT ST_Centroid(g::geography)::geometry AS c) s;
$$;

CREATE TABLE IF NOT EXISTS places (
  id          serial PRIMARY KEY,
  name        text NOT NULL,
  aliases     text[] NOT NULL DEFAULT '{}',
  kind        text NOT NULL CHECK (kind IN ('city', 'region', 'country')),
  geom        geography(Point, 4326) NOT NULL,
  bbox        geometry(Geometry, 4326) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS places_name_kind_lower_uidx ON places (lower(name), kind);
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
  bbox            geometry(Polygon, 4326) GENERATED ALWAYS AS (overwatch_asset_bbox(geom)) STORED,
  tags            jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (osm_type, osm_id)
);

CREATE INDEX IF NOT EXISTS assets_geom_gix ON assets USING GIST (geom);
CREATE INDEX IF NOT EXISTS assets_geom_geog_gix ON assets USING GIST ((geom::geography));
CREATE INDEX IF NOT EXISTS assets_centroid_gix ON assets USING GIST (centroid);
CREATE INDEX IF NOT EXISTS assets_bbox_gix ON assets USING GIST (bbox);
CREATE INDEX IF NOT EXISTS assets_type_idx ON assets (canonical_type);
CREATE INDEX IF NOT EXISTS assets_operator_idx ON assets (operator);
