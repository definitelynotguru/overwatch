#!/usr/bin/env bash
# Import a local Geofabrik extract into Overwatch. Never fetches data.
# Usage: ./scripts/import-pbf.sh /path/to/region-latest.osm.pbf
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PBF="${1:-}"
if [[ -z "$PBF" || ! -f "$PBF" ]]; then
  echo "Usage: $0 /path/to/region-latest.osm.pbf" >&2
  exit 1
fi
command -v osmium >/dev/null || { echo "install osmium-tool"; exit 1; }
TMP="$(mktemp -d)"
trap "rm -rf $TMP" EXIT
osmium tags-filter "$PBF" nwr/aeroway nwr/man_made nwr/power nwr/industrial nwr/landuse=port nwr/building=data_centre -o "$TMP/filtered.osm.pbf" --overwrite
osmium export "$TMP/filtered.osm.pbf" --geometry-types=point -o "$TMP/points.geojson" --overwrite
python3 "$ROOT/scripts/load-geojson.py" "$TMP/points.geojson"
