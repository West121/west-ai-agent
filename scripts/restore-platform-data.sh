#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup-dir>" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_BASE="$ROOT_DIR/infra/docker/docker-compose.yml"
COMPOSE_PROD="$ROOT_DIR/infra/docker/docker-compose.prod.yml"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
if [[ ! -f "$ENV_FILE" && -f "$ROOT_DIR/.env.example" ]]; then
  ENV_FILE="$ROOT_DIR/.env.example"
fi
BACKUP_DIR="$1"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-platform}"

if [[ ! -d "$BACKUP_DIR" ]]; then
  echo "Backup directory not found: $BACKUP_DIR" >&2
  exit 1
fi

echo "Restoring from $BACKUP_DIR"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_BASE" -f "$COMPOSE_PROD" down

mkdir -p "$ROOT_DIR/data"
for service_dir in postgres redis minio opensearch; do
  ARCHIVE="$BACKUP_DIR/${service_dir}.tar.gz"
  if [[ -f "$ARCHIVE" ]]; then
    rm -rf "$ROOT_DIR/data/$service_dir"
    tar -xzf "$ARCHIVE" -C "$ROOT_DIR/data"
  fi
done

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_BASE" -f "$COMPOSE_PROD" up -d postgres redis minio opensearch

if [[ -f "$BACKUP_DIR/postgres.sql" ]]; then
  cat "$BACKUP_DIR/postgres.sql" | docker compose --env-file "$ENV_FILE" -f "$COMPOSE_BASE" -f "$COMPOSE_PROD" exec -T postgres \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
fi

echo "Restore completed from $BACKUP_DIR"
