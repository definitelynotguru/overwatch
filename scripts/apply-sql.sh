#!/usr/bin/env bash
# Apply a SQL file to the Overwatch database. Prefers a running container.
# Usage: ./scripts/apply-sql.sh db/migrate_geom.sql
set -euo pipefail
FILE="${1:-}"
if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  echo "Usage: $0 path/to/file.sql" >&2
  exit 1
fi
if docker inspect -f '{{.State.Running}}' overwatch-postgres 2>/dev/null | grep -q true; then
  docker exec -i overwatch-postgres psql -U overwatch -d overwatch -v ON_ERROR_STOP=1 < "$FILE"
elif command -v psql >/dev/null 2>&1; then
  psql "${DATABASE_URL:-postgres://overwatch:overwatch@127.0.0.1:5432/overwatch}" -v ON_ERROR_STOP=1 -f "$FILE"
else
  echo "Need a running overwatch-postgres container or psql on PATH" >&2
  exit 1
fi
