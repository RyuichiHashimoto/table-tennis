#!/usr/bin/env python3
"""SQLite の試合別 rallies を PostgreSQL の points へ移行する。"""

from __future__ import annotations

import argparse
import os
import sqlite3
from pathlib import Path
from typing import Any


POINT_COLUMNS = [
    "uuid",
    "match_id",
    "set_no",
    "server",
    "point_winner",
    "sort_order",
    "starred",
    "result_tag",
    "t_start",
    "t_end",
    "serve_type",
    "receive_type",
    "my_3rd",
    "my_3rd_result",
    "rally_len_bucket",
    "end_reason",
    "end_side",
    "note",
    "created_at",
    "updated_at",
    "is_deleted",
    "deleted_at",
]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--matches-dir",
        default="backend/data/matches",
        help="SQLite の {match_uuid}.sqlite が入っているディレクトリ。",
    )
    args = parser.parse_args()

    matches_dir = Path(args.matches_dir)
    if not matches_dir.is_dir():
        raise SystemExit(f"matches directory not found: {matches_dir}")

    import psycopg2
    from psycopg2.extras import execute_batch

    conn = psycopg2.connect(
        dbname=os.getenv("POSTGRES_DB", "table_tennis"),
        user=os.getenv("POSTGRES_USER", "table_tennis_user"),
        password=os.getenv("POSTGRES_PASSWORD", "table_tennis_password"),
        host=os.getenv("DB_HOST", "table-tennis-db"),
        port=os.getenv("DB_PORT", "5432"),
    )
    try:
        with conn:
            with conn.cursor() as cur:
                total = 0
                for sqlite_path in sorted(matches_dir.glob("*.sqlite")):
                    match_uuid = sqlite_path.stem
                    cur.execute("SELECT id FROM matches WHERE uuid = %s AND is_deleted = FALSE", (match_uuid,))
                    row = cur.fetchone()
                    if row is None:
                        print(f"skip: match not found in PostgreSQL: {match_uuid}")
                        continue
                    match_id = int(row[0])
                    points = list(read_points(sqlite_path, match_id))
                    if not points:
                        print(f"skip: no points: {sqlite_path.name}")
                        continue
                    execute_batch(cur, build_upsert_sql(), points, page_size=200)
                    total += len(points)
                    print(f"migrated: {sqlite_path.name}: {len(points)} points")
                cur.execute("SELECT setval('points_id_seq', COALESCE((SELECT MAX(id) FROM points), 1))")
                print(f"done: {total} points migrated")
    finally:
        conn.close()


def read_points(sqlite_path: Path, match_id: int) -> list[dict[str, Any]]:
    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            """
            SELECT
                uuid,
                sort_order,
                starred,
                set_no,
                server,
                serve_type,
                receive_type,
                rally_len_bucket,
                point_winner,
                end_reason,
                end_side,
                my_3rd,
                my_3rd_result,
                result_tag,
                t_start,
                t_end,
                note,
                created_at
            FROM rallies
            ORDER BY sort_order ASC, id ASC
            """
        ).fetchall()
    finally:
        conn.close()

    return [
        {
            "uuid": row["uuid"],
            "match_id": match_id,
            "set_no": row["set_no"],
            "server": row["server"],
            "point_winner": row["point_winner"],
            "sort_order": row["sort_order"],
            "starred": bool(row["starred"]),
            "result_tag": none_if_empty(row["result_tag"]),
            "t_start": row["t_start"],
            "t_end": row["t_end"],
            "serve_type": none_if_empty(row["serve_type"]),
            "receive_type": row["receive_type"],
            "my_3rd": none_if_empty(row["my_3rd"]),
            "my_3rd_result": none_if_empty(row["my_3rd_result"]),
            "rally_len_bucket": row["rally_len_bucket"],
            "end_reason": row["end_reason"],
            "end_side": row["end_side"],
            "note": none_if_empty(row["note"]),
            "created_at": row["created_at"],
            "updated_at": row["created_at"],
            "is_deleted": False,
            "deleted_at": None,
        }
        for row in rows
    ]


def none_if_empty(value: Any) -> Any:
    return None if value == "" else value


def build_upsert_sql() -> str:
    columns = ", ".join(POINT_COLUMNS)
    placeholders = ", ".join(f"%({column})s" for column in POINT_COLUMNS)
    update_columns = [
        "match_id",
        "set_no",
        "server",
        "point_winner",
        "sort_order",
        "starred",
        "result_tag",
        "t_start",
        "t_end",
        "serve_type",
        "receive_type",
        "my_3rd",
        "my_3rd_result",
        "rally_len_bucket",
        "end_reason",
        "end_side",
        "note",
        "is_deleted",
        "deleted_at",
    ]
    updates = ", ".join(f"{column} = EXCLUDED.{column}" for column in update_columns)
    return f"""
        INSERT INTO points ({columns})
        VALUES ({placeholders})
        ON CONFLICT (uuid) DO UPDATE SET
            {updates},
            updated_at = now()
    """


if __name__ == "__main__":
    main()
