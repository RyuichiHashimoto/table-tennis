#!/bin/bash

set -e

DB_NAME="${POSTGRES_DB:-table_tennis}"
DB_USER="${POSTGRES_USER:-table_tennis_user}"
DB_PASSWORD="${POSTGRES_PASSWORD:-table_tennis_password}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

SQL_FILE="$1"

if [ -z "$SQL_FILE" ]; then
  echo "使い方: $0 <sqlファイル>"
  exit 1
fi

if [ ! -f "$SQL_FILE" ]; then
  echo "エラー: SQLファイルが見つかりません: $SQL_FILE"
  exit 1
fi

PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -f "$SQL_FILE"