#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_BASE="$ROOT_DIR/infra/docker/docker-compose.yml"
COMPOSE_PROD="$ROOT_DIR/infra/docker/docker-compose.prod.yml"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
if [[ ! -f "$ENV_FILE" && -f "$ROOT_DIR/.env.example" ]]; then
  ENV_FILE="$ROOT_DIR/.env.example"
fi
BACKUP_ROOT="${BACKUP_ROOT:-$ROOT_DIR/backups}"
TIMESTAMP="${TIMESTAMP:-$(date +%Y%m%d-%H%M%S)}"
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-platform}"

mkdir -p "$BACKUP_DIR"

echo "Creating backup in $BACKUP_DIR"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_BASE" -f "$COMPOSE_PROD" ps postgres >/dev/null 2>&1 || {
  echo "Postgres service is not available through docker compose." >&2
  exit 1
}

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_BASE" -f "$COMPOSE_PROD" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" >"$BACKUP_DIR/postgres.sql"

for service_dir in postgres redis minio opensearch; do
  SOURCE_DIR="$ROOT_DIR/data/$service_dir"
  if [[ -d "$SOURCE_DIR" ]]; then
    tar -czf "$BACKUP_DIR/${service_dir}.tar.gz" -C "$ROOT_DIR/data" "$service_dir"
  fi
done

cat >"$BACKUP_DIR/manifest.txt" <<EOF
timestamp=$TIMESTAMP
postgres_user=$POSTGRES_USER
postgres_db=$POSTGRES_DB
backup_dir=$BACKUP_DIR
EOF

echo "Backup completed: $BACKUP_DIR"
