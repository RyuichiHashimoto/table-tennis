#!/usr/bin/env bash

set -Eeuo pipefail

DB_NAME="${POSTGRES_DB:-table_tennis}"
DB_USER="${POSTGRES_USER:-table_tennis_user}"
DB_PASSWORD="${POSTGRES_PASSWORD:-table_tennis_password}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

TABLE_NAME="${1:-}"
SCHEMA_NAME="${2:-public}"

if [[ -z "$TABLE_NAME" ]]; then
  echo "使い方: $0 <テーブル名> [スキーマ名]" >&2
  exit 1
fi

PGPASSWORD="$DB_PASSWORD" psql \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --set=ON_ERROR_STOP=1 \
  --set=table_name="$TABLE_NAME" \
  --set=schema_name="$SCHEMA_NAME" \
  --pset=pager=off <<'SQL'
SELECT * FROM :"schema_name".:"table_name";
SQL
