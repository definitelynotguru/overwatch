-- Apply on existing Neon/local DBs that still have geography(Point) assets.geom.
-- Idempotent. Existing point rows survive via geography -> geometry cast.
-- New installs should use db/schema.sql instead.
CREATE EXTENSION IF NOT EXISTS postgis;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'assets'
      AND column_name = 'geom'
      AND udt_name = 'geography'
  ) THEN
    DROP INDEX IF EXISTS assets_geom_gix;
    ALTER TABLE assets
      ALTER COLUMN geom TYPE geometry(Geometry, 4326)
      USING ST_SetSRID(geom::geometry, 4326);
  ELSIF EXISTS (
    SELECT 1
    FROM geometry_columns
    WHERE f_table_schema = 'public'
      AND f_table_name = 'assets'
      AND f_geometry_column = 'geom'
      AND type IN ('POINT', 'MULTIPOINT')
  ) THEN
    DROP INDEX IF EXISTS assets_geom_gix;
    ALTER TABLE assets
      ALTER COLUMN geom TYPE geometry(Geometry, 4326)
      USING geom;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'centroid'
  ) THEN
    ALTER TABLE assets
      ADD COLUMN centroid geography(Point, 4326)
      GENERATED ALWAYS AS (ST_SetSRID(ST_Centroid(geom), 4326)::geography) STORED;
  END IF;
END $$;

-- places.bbox must hold real MultiPolygons, not dateline-broken envelopes.
ALTER TABLE places
  ALTER COLUMN bbox TYPE geometry(Geometry, 4326)
  USING bbox;

DROP INDEX IF EXISTS places_name_lower_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS places_name_kind_lower_uidx ON places (lower(name), kind);

DROP INDEX IF EXISTS assets_bbox_gix;
ALTER TABLE assets DROP COLUMN IF EXISTS bbox;

DROP FUNCTION IF EXISTS overwatch_asset_bbox(geometry);
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

ALTER TABLE assets
  ADD COLUMN bbox geometry(Polygon, 4326)
  GENERATED ALWAYS AS (overwatch_asset_bbox(geom)) STORED;

CREATE INDEX IF NOT EXISTS assets_geom_gix ON assets USING GIST (geom);
CREATE INDEX IF NOT EXISTS assets_geom_geog_gix ON assets USING GIST ((geom::geography));
CREATE INDEX IF NOT EXISTS assets_centroid_gix ON assets USING GIST (centroid);
CREATE INDEX IF NOT EXISTS assets_bbox_gix ON assets USING GIST (bbox);
CREATE INDEX IF NOT EXISTS places_bbox_gix ON places USING GIST (bbox);
