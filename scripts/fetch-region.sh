#!/usr/bin/env bash
# Download one documented Geofabrik extract for local densify. Idempotent.
# Never imports — fetch only. Never fetches the planet.
# Usage:
#   ./scripts/fetch-region.sh [region] [--force]
#   REGION=new-york ./scripts/fetch-region.sh
#   npm run db:fetch-region -- new-york
# Regions: greater-london (default), new-york (see scripts/regions.sh)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=regions.sh
source "$ROOT/scripts/regions.sh"

FORCE=0
TOKEN=""
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    --list)
      ow_list_regions
      exit 0
      ;;
    -h|--help)
      echo "Usage: $0 [region] [--force]"
      echo "       REGION=<region> $0 [--force]"
      echo
      ow_list_regions
      exit 0
      ;;
    -*)
      echo "Unknown flag: $arg" >&2
      echo "Usage: $0 [region] [--force]" >&2
      exit 1
      ;;
    *)
      if [[ -n "$TOKEN" ]]; then
        echo "Usage: $0 [region] [--force]" >&2
        exit 1
      fi
      TOKEN="$arg"
      ;;
  esac
done

if [[ -n "$TOKEN" ]]; then
  REGION_ID="$(ow_normalize_region "$TOKEN")" || exit 1
elif [[ -n "${REGION:-}" ]]; then
  REGION_ID="$(ow_normalize_region "$REGION")" || exit 1
else
  REGION_ID="$(ow_normalize_region "$OW_DEFAULT_REGION")" || exit 1
fi

NAME="$(ow_region_pbf_name "$REGION_ID")"
URL="$(ow_region_url "$REGION_ID")"
LABEL="$(ow_region_label "$REGION_ID")"
DIR="$ROOT/data"
OUT="$DIR/$NAME"

mkdir -p "$DIR"
if [[ -f "$OUT" && "$FORCE" -eq 0 ]]; then
  echo "cached $OUT ($(du -h "$OUT" | cut -f1)) [$LABEL]"
  exit 0
fi

TMP="$OUT.partial"
echo "fetching $URL ($LABEL)"
# curl follows redirects; -C - resumes; writes to .partial then renames
curl -fL --retry 3 --retry-delay 2 -C - -o "$TMP" "$URL"
if head -c 15 "$TMP" | grep -q "<!DOCTYPE\|<html"; then
  echo "download returned HTML, not a PBF: $URL" >&2
  rm -f "$TMP"
  exit 1
fi
if [[ $(stat -c%s "$TMP") -lt 1000000 ]]; then
  echo "download too small to be $LABEL PBF ($(stat -c%s "$TMP") bytes)" >&2
  rm -f "$TMP"
  exit 1
fi
mv -f "$TMP" "$OUT"
echo "wrote $OUT ($(du -h "$OUT" | cut -f1))"
