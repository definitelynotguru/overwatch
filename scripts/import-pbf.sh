#!/usr/bin/env bash
# Import a local Geofabrik extract into Overwatch. Never fetches data.
# Nodes stay points. Ways stay linestrings. Closed ways / multipolygons that
# are areas stay polygons. No centroid-on-import.
# Filters cover every RULES / classify type in load-geojson.py.
# Usage: ./scripts/import-pbf.sh [/path/to/region-latest.osm.pbf]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PBF="${1:-$ROOT/data/greater-london-latest.osm.pbf}"
if [[ ! -f "$PBF" ]]; then
  echo "Usage: $0 [/path/to/region-latest.osm.pbf]" >&2
  echo "Missing PBF: $PBF" >&2
  echo "Fetch first: ./scripts/fetch-region.sh" >&2
  exit 1
fi
command -v osmium >/dev/null || { echo "install osmium-tool"; exit 1; }
TMP="$(mktemp -d)"
trap "rm -rf $TMP" EXIT
# aeroway → airport, helipad
# man_made → bridge, pipeline, telecom towers, works/refinery
# power → power_plant, substation
# industrial → refinery
# landuse=industrial / landuse=port → industrial, port
# building=data_centre → data_center
# communication:mobile_phone → telecom (key not covered by man_made alone)
osmium tags-filter "$PBF" \
  nwr/aeroway \
  nwr/man_made \
  nwr/power \
  nwr/industrial \
  nwr/landuse=industrial \
  nwr/landuse=port \
  nwr/building=data_centre \
  nwr/communication:mobile_phone \
  -o "$TMP/filtered.osm.pbf" --overwrite
osmium export "$TMP/filtered.osm.pbf" --geometry-types=point,linestring,polygon -a type,id -o "$TMP/features.geojson" --overwrite
python3 "$ROOT/scripts/load-geojson.py" "$TMP/features.geojson"
