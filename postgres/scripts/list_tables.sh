#!/usr/bin/env bash

set -Eeuo pipefail

DB_NAME="${POSTGRES_DB:-table_tennis}"
DB_USER="${POSTGRES_USER:-table_tennis_user}"
DB_PASSWORD="${POSTGRES_PASSWORD:-table_tennis_password}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

PGPASSWORD="$DB_PASSWORD" psql \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --set=ON_ERROR_STOP=1 \
  --pset=pager=off \
  --command="
    SELECT
      schemaname AS schema_name,
      tablename AS table_name
    FROM pg_catalog.pg_tables
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY schemaname, tablename;
  "
