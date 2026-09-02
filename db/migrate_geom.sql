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
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'bbox'
  ) THEN
    ALTER TABLE assets
      ADD COLUMN bbox geometry(Polygon, 4326)
      GENERATED ALWAYS AS (
        ST_MakeEnvelope(
          ST_XMin(geom),
          ST_YMin(geom),
          GREATEST(ST_XMax(geom), ST_XMin(geom) + 1e-8),
          GREATEST(ST_YMax(geom), ST_YMin(geom) + 1e-8),
          4326
        )
      ) STORED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS assets_geom_gix ON assets USING GIST (geom);
CREATE INDEX IF NOT EXISTS assets_geom_geog_gix ON assets USING GIST ((geom::geography));
CREATE INDEX IF NOT EXISTS assets_centroid_gix ON assets USING GIST (centroid);
CREATE INDEX IF NOT EXISTS assets_bbox_gix ON assets USING GIST (bbox);
