#!/usr/bin/env bash
# Shared Geofabrik region registry for fetch / import / densify.
# Source from other scripts:  # shellcheck source=regions.sh
#   source "$(dirname "$0")/regions.sh"
#
# Documented extracts (never the planet):
#   greater-london  europe/united-kingdom/england/greater-london
#   new-york        north-america/us/new-york  (state; densifies gallery "bridges in new york")
# Aliases: london → greater-london; nyc | new-york-city | us/new-york → new-york

OW_DEFAULT_REGION="${OW_DEFAULT_REGION:-greater-london}"

ow_normalize_region() {
  local raw="${1:-}"
  raw="$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]' | tr '_ ' '--' | sed 's/--*/-/g')"
  case "$raw" in
    "" ) printf '%s\n' "$OW_DEFAULT_REGION" ;;
    greater-london|london|england/greater-london) printf 'greater-london\n' ;;
    new-york|new-york-city|nyc|us/new-york|newyork) printf 'new-york\n' ;;
    *)
      echo "unknown region: ${1:-} (known: greater-london, new-york)" >&2
      return 1
      ;;
  esac
}

ow_region_pbf_name() {
  case "$(ow_normalize_region "$1")" in
    greater-london) printf 'greater-london-latest.osm.pbf\n' ;;
    new-york) printf 'new-york-latest.osm.pbf\n' ;;
    *) return 1 ;;
  esac
}

ow_region_url() {
  case "$(ow_normalize_region "$1")" in
    greater-london)
      printf 'https://download.geofabrik.de/europe/united-kingdom/england/greater-london-latest.osm.pbf\n'
      ;;
    new-york)
      printf 'https://download.geofabrik.de/north-america/us/new-york-latest.osm.pbf\n'
      ;;
    *) return 1 ;;
  esac
}

ow_region_label() {
  case "$(ow_normalize_region "$1")" in
    greater-london) printf 'Greater London\n' ;;
    new-york) printf 'New York (US state)\n' ;;
    *) return 1 ;;
  esac
}

# Resolve CLI/env/default to an absolute PBF path under $1 (repo root).
# Args: ROOT [token]
# token may be a filesystem path, a region id/alias, or empty (use REGION env / default).
ow_resolve_pbf() {
  local root="$1"
  local token="${2:-}"
  if [[ -n "$token" && -f "$token" ]]; then
    printf '%s\n' "$(cd "$(dirname "$token")" && pwd)/$(basename "$token")"
    return 0
  fi
  if [[ -n "$token" && -f "$root/$token" ]]; then
    printf '%s\n' "$root/$token"
    return 0
  fi
  local region
  if [[ -n "$token" ]]; then
    region="$(ow_normalize_region "$token")" || return 1
  elif [[ -n "${REGION:-}" ]]; then
    region="$(ow_normalize_region "$REGION")" || return 1
  else
    region="$(ow_normalize_region "$OW_DEFAULT_REGION")" || return 1
  fi
  printf '%s\n' "$root/data/$(ow_region_pbf_name "$region")"
}

ow_list_regions() {
  cat <<'LIST'
greater-london   europe/united-kingdom/england/greater-london-latest.osm.pbf  (default)
new-york         north-america/us/new-york-latest.osm.pbf  (aliases: nyc, new-york-city)
LIST
}
