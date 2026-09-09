#!/usr/bin/env bash
# Fetch one documented Geofabrik extract, then import via the single import path.
# Usage:
#   ./scripts/densify.sh [region] [--force]
#   REGION=new-york ./scripts/densify.sh
#   npm run db:densify -- new-york
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=regions.sh
source "$ROOT/scripts/regions.sh"

FORCE=0
TOKEN=""
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
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

FETCH_ARGS=()
IMPORT_TOKEN=""
if [[ -n "$TOKEN" ]]; then
  FETCH_ARGS+=("$TOKEN")
  IMPORT_TOKEN="$TOKEN"
elif [[ -n "${REGION:-}" ]]; then
  IMPORT_TOKEN="$REGION"
fi
if [[ "$FORCE" -eq 1 ]]; then
  FETCH_ARGS+=(--force)
fi

"$ROOT/scripts/fetch-region.sh" "${FETCH_ARGS[@]}"
if [[ -n "$IMPORT_TOKEN" ]]; then
  "$ROOT/scripts/import-pbf.sh" "$IMPORT_TOKEN"
else
  "$ROOT/scripts/import-pbf.sh"
fi
