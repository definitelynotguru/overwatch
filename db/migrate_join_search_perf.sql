-- Join-search perf: composite GiST (canonical_type, geom::geography) for nested EXISTS ST_DWithin.
-- Idempotent. Requires btree_gist (ships with Postgres contrib).
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE INDEX IF NOT EXISTS assets_type_geom_geog_gix ON assets USING GIST (canonical_type, (geom::geography));
