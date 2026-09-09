#!/usr/bin/env bash
# Import a local Geofabrik extract into Overwatch. Never fetches data.
# Single import path for every documented region (and any other local PBF).
# Nodes stay points. Ways stay linestrings. Closed ways / multipolygons that
# are areas stay polygons. No centroid-on-import.
# Filters cover every RULES / classify type in load-geojson.py.
# Usage:
#   ./scripts/import-pbf.sh [/path/to/region-latest.osm.pbf | region]
#   REGION=new-york ./scripts/import-pbf.sh
#   npm run db:import-pbf -- new-york
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=regions.sh
source "$ROOT/scripts/regions.sh"

TOKEN="${1:-}"
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  echo "Usage: $0 [/path/to/region-latest.osm.pbf | region]"
  echo "       REGION=<region> $0"
  echo
  ow_list_regions
  exit 0
fi
if [[ -n "${1:-}" && "${1:-}" == -* ]]; then
  echo "Usage: $0 [/path/to/region-latest.osm.pbf | region]" >&2
  exit 1
fi

PBF="$(ow_resolve_pbf "$ROOT" "$TOKEN")" || exit 1
if [[ ! -f "$PBF" ]]; then
  echo "Usage: $0 [/path/to/region-latest.osm.pbf | region]" >&2
  echo "Missing PBF: $PBF" >&2
  echo "Fetch first: ./scripts/fetch-region.sh ${TOKEN:-${REGION:-}}" >&2
  exit 1
fi
command -v osmium >/dev/null || { echo "install osmium-tool"; exit 1; }
TMP="$(mktemp -d)"
trap "rm -rf $TMP" EXIT
# aeroway → airport, helipad
# man_made → bridge, pipeline, telecom towers/masts, works/refinery
# power → power_plant, substation, power_line (line/cable/minor_line)
# industrial → refinery
# landuse=industrial / landuse=port → industrial, port
# building=data_centre → data_center
# communication:* → telecom (keys not covered by man_made alone)
# bridge=* → bridge (highway/railway bridges without man_made=bridge)
# route=pipeline → pipeline relations/ways
# telecom=exchange → telephone_exchange
osmium tags-filter "$PBF" \
  nwr/aeroway \
  nwr/man_made \
  nwr/power \
  nwr/industrial \
  nwr/landuse=industrial \
  nwr/landuse=port \
  nwr/building=data_centre \
  nwr/communication:mobile_phone \
  nwr/communication:radio \
  nwr/bridge \
  nwr/route=pipeline \
  nwr/telecom \
  -o "$TMP/filtered.osm.pbf" --overwrite
osmium export "$TMP/filtered.osm.pbf" --geometry-types=point,linestring,polygon -a type,id -o "$TMP/features.geojson" --overwrite
python3 "$ROOT/scripts/load-geojson.py" "$TMP/features.geojson"
