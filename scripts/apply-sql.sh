#!/usr/bin/env bash
# Apply a SQL file to the Overwatch database.
# Prefers DATABASE_URL / libpq PG* env (remote Neon) over a local Docker
# container so `npm run db:migrate` against Neon is not shadowed by
# an accidental overwatch-postgres container.
# Usage: ./scripts/apply-sql.sh db/migrate_geom.sql
set -euo pipefail
FILE="${1:-}"
if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  echo "Usage: $0 path/to/file.sql" >&2
  exit 1
fi

run_psql_file() {
  # Prefer PG* so the password never appears on the process argv.
  # Neon (and most managed PostGIS) need SSL; default require when unset.
  export PGSSLMODE="${PGSSLMODE:-require}"
  if [[ -n "${PGHOST:-}" && -n "${PGUSER:-}" && -n "${PGDATABASE:-}" ]]; then
    psql -v ON_ERROR_STOP=1 -f "$FILE"
  elif [[ -n "${DATABASE_URL:-}" ]]; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$FILE"
  else
    psql "postgres://overwatch:overwatch@127.0.0.1:5432/overwatch" -v ON_ERROR_STOP=1 -f "$FILE"
  fi
}

if [[ -n "${DATABASE_URL:-}" || -n "${PGHOST:-}" ]]; then
  if ! command -v psql >/dev/null 2>&1; then
    echo "psql required when DATABASE_URL or PGHOST is set" >&2
    exit 1
  fi
  run_psql_file
elif docker inspect -f '{{.State.Running}}' overwatch-postgres 2>/dev/null | grep -q true; then
  docker exec -i overwatch-postgres psql -U overwatch -d overwatch -v ON_ERROR_STOP=1 < "$FILE"
elif command -v psql >/dev/null 2>&1; then
  run_psql_file
else
  echo "Need DATABASE_URL/PGHOST, a running overwatch-postgres container, or psql on PATH" >&2
  exit 1
fi
