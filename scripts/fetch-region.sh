#!/usr/bin/env bash
# Download one documented Geofabrik extract for local densify. Idempotent.
# Default: Greater London (small, dense joins). Never imports — fetch only.
# Usage: ./scripts/fetch-region.sh [--force]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FORCE=0
if [[ "${1:-}" == "--force" ]]; then
  FORCE=1
elif [[ -n "${1:-}" ]]; then
  echo "Usage: $0 [--force]" >&2
  exit 1
fi

NAME="greater-london-latest.osm.pbf"
URL="https://download.geofabrik.de/europe/united-kingdom/england/greater-london-latest.osm.pbf"
DIR="$ROOT/data"
OUT="$DIR/$NAME"

mkdir -p "$DIR"
if [[ -f "$OUT" && "$FORCE" -eq 0 ]]; then
  echo "cached $OUT ($(du -h "$OUT" | cut -f1))"
  exit 0
fi

TMP="$OUT.partial"
echo "fetching $URL"
# curl follows redirects; -C - resumes; writes to .partial then renames
curl -fL --retry 3 --retry-delay 2 -C - -o "$TMP" "$URL"
if head -c 15 "$TMP" | grep -q "<!DOCTYPE\|<html"; then
  echo "download returned HTML, not a PBF: $URL" >&2
  rm -f "$TMP"
  exit 1
fi
if [[ $(stat -c%s "$TMP") -lt 1000000 ]]; then
  echo "download too small to be Greater London PBF ($(stat -c%s "$TMP") bytes)" >&2
  rm -f "$TMP"
  exit 1
fi
mv -f "$TMP" "$OUT"
echo "wrote $OUT ($(du -h "$OUT" | cut -f1))"
