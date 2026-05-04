import json
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd

BASE_DIR = Path("data/matches")
INDEX_DB_PATH = BASE_DIR / "index.sqlite"
SERVER_ROTATION_MIGRATION_MATCH_UUIDS = {
    "10acc7a3-c3fa-4478-8499-b9d583ed7276",
}
DEFAULT_TAG_DEFINITIONS = [
    # サーブ局面
    {"tag": "サーブミス", "player_side": "me", "phase": "serve", "shot_type": "miss"},
    {"tag": "サーブミス", "player_side": "op", "phase": "serve", "shot_type": "miss"},
    {"tag": "サーブ得点", "player_side": "me", "phase": "serve", "shot_type": "point"},
    # レシーブ局面
    {"tag": "レシーブミス", "player_side": "me", "phase": "receive", "shot_type": "miss"},
    {"tag": "レシーブミス", "player_side": "op", "phase": "receive", "shot_type": "miss"},
    {"tag": "レシーブ得点", "player_side": "me", "phase": "receive", "shot_type": "point"},
    # ラリー中
    {"tag": "ドライブミス", "player_side": "me", "phase": "rally", "shot_type": "miss"},
    {"tag": "ドライブミス", "player_side": "op", "phase": "rally", "shot_type": "miss"},
    {"tag": "ツッツキミス", "player_side": "me", "phase": "rally", "shot_type": "miss"},
    {"tag": "ツッツキミス", "player_side": "op", "phase": "rally", "shot_type": "miss"},
    {"tag": "ブロックミス", "player_side": "me", "phase": "rally", "shot_type": "miss"},
    {"tag": "ブロックミス", "player_side": "op", "phase": "rally", "shot_type": "miss"},
    {"tag": "ラリーミス", "player_side": "me", "phase": "rally", "shot_type": "miss"},
    {"tag": "ラリーミス", "player_side": "op", "phase": "rally", "shot_type": "miss"},
    {"tag": "3球目得点", "player_side": "me", "phase": "rally", "shot_type": "point"},
    {"tag": "ラリー得点", "player_side": "me", "phase": "rally", "shot_type": "point"},
    # 特殊
    {"tag": "ネットイン", "player_side": "both", "phase": "rally", "shot_type": "any"},
    {"tag": "エッジボール", "player_side": "both", "phase": "rally", "shot_type": "any"},
]


def _guess_phase(tag_name: str) -> str:
    """タグ名から局面を推測する（マイグレーション用）。"""
    if "サーブ" in tag_name:
        return "serve"
    if "レシーブ" in tag_name:
        return "receive"
    return "rally"


def _migrate_tag_definitions_v2(cur: sqlite3.Cursor, conn: sqlite3.Connection) -> None:
    """旧スキーマのタグ定義を新スキーマへ移行する。"""
    cur.execute(
        "SELECT id, tag, my_rally_only, opponent_rally_only, loss_only, win_only, created_at, updated_at FROM tag_definitions"
    )
    old_rows = cur.fetchall()

    cur.execute("ALTER TABLE tag_definitions RENAME TO tag_definitions_old")
    cur.execute(
        """
        CREATE TABLE tag_definitions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tag TEXT NOT NULL,
            player_side TEXT NOT NULL DEFAULT 'me',
            phase TEXT NOT NULL DEFAULT 'rally',
            shot_type TEXT NOT NULL DEFAULT 'miss',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    now = datetime.now().isoformat(timespec="seconds")
    for row in old_rows:
        _, tag, my_rally_only, opponent_rally_only, loss_only, win_only, created_at, updated_at = row
        if my_rally_only:
            player_side = "me"
            shot_type = "miss" if loss_only else "point"
        elif opponent_rally_only:
            player_side = "op"
            # loss_only=1 (I lose) with op_only means op scored = op's point
            # win_only=1 (I win) with op_only means op missed = op's miss
            shot_type = "point" if loss_only else "miss"
        else:
            player_side = "both"
            shot_type = "any"
        cur.execute(
            """
            INSERT INTO tag_definitions (tag, player_side, phase, shot_type, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (tag, player_side, _guess_phase(tag), shot_type, created_at or now, updated_at or now),
        )
    cur.execute("DROP TABLE tag_definitions_old")
    conn.commit()


def init_match_store() -> None:
    """試合別ストアのインデックス DB と初期タグ定義を準備する。
    """
    BASE_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(INDEX_DB_PATH, check_same_thread=False)
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS matches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            initial_server TEXT NOT NULL DEFAULT 'me',
            my_player_name TEXT NOT NULL DEFAULT '自分',
            opponent_player_name TEXT NOT NULL DEFAULT '相手',
            created_at TEXT NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS tag_definitions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tag TEXT NOT NULL,
            player_side TEXT NOT NULL DEFAULT 'me',
            phase TEXT NOT NULL DEFAULT 'rally',
            shot_type TEXT NOT NULL DEFAULT 'miss',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.commit()

    cur.execute("PRAGMA table_info(tag_definitions)")
    columns = {row[1] for row in cur.fetchall()}
    if "my_rally_only" in columns:
        _migrate_tag_definitions_v2(cur, conn)

    cur.execute("SELECT COUNT(*) FROM tag_definitions")
    count = int(cur.fetchone()[0] or 0)
    if count == 0:
        now = datetime.now().isoformat(timespec="seconds")
        cur.executemany(
            """
            INSERT INTO tag_definitions (tag, player_side, phase, shot_type, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            [
                (row["tag"], row["player_side"], row["phase"], row["shot_type"], now, now)
                for row in DEFAULT_TAG_DEFINITIONS
            ],
        )
        conn.commit()
    conn.close()


def _index_conn() -> sqlite3.Connection:
    """試合インデックス DB への接続を作成する。

    Returns
    -------
    sqlite3.Connection
        SQLite 接続オブジェクト。
    """
    return sqlite3.connect(INDEX_DB_PATH, check_same_thread=False)


def _match_db_path(match_uuid: str) -> Path:
    """試合 UUID に対応する SQLite ファイルパスを返す。

    Parameters
    ----------
    match_uuid : str
        対象試合の UUID。

    Returns
    -------
    Path
        作成または解決された Path。
    """
    return BASE_DIR / f"{match_uuid}.sqlite"


def _match_conn(match_uuid: str) -> sqlite3.Connection:
    """指定した試合 DB への接続を作成する。

    Parameters
    ----------
    match_uuid : str
        対象試合の UUID。

    Returns
    -------
    sqlite3.Connection
        SQLite 接続オブジェクト。
    """
    return sqlite3.connect(_match_db_path(match_uuid), check_same_thread=False)


def _init_match_db(match_uuid: str) -> None:
    """指定した試合 DB のスキーマを初期化する。

    Parameters
    ----------
    match_uuid : str
        対象試合の UUID。
    """
    conn = _match_conn(match_uuid)
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS match_meta (
            uuid TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            initial_server TEXT NOT NULL DEFAULT 'me',
            my_player_name TEXT NOT NULL DEFAULT '自分',
            opponent_player_name TEXT NOT NULL DEFAULT '相手',
            created_at TEXT NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS rallies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT NOT NULL UNIQUE,
            sort_order REAL NOT NULL,
            starred INTEGER NOT NULL DEFAULT 0,
            set_no INTEGER NOT NULL,
            server TEXT NOT NULL,
            serve_type TEXT,
            receive_type TEXT NOT NULL,
            rally_len_bucket TEXT NOT NULL,
            point_winner TEXT NOT NULL,
            end_reason TEXT NOT NULL,
            end_side TEXT NOT NULL,
            my_3rd TEXT,
            my_3rd_result TEXT,
            result_tag TEXT,
            t_start REAL,
            t_end REAL,
            note TEXT,
            created_at TEXT NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS input_state (
            match_uuid TEXT PRIMARY KEY,
            state_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.commit()
    cur.execute("PRAGMA table_info(match_meta)")
    columns = {row[1] for row in cur.fetchall()}
    if "initial_server" not in columns:
        cur.execute("ALTER TABLE match_meta ADD COLUMN initial_server TEXT NOT NULL DEFAULT 'me'")
    if "my_player_name" not in columns:
        cur.execute("ALTER TABLE match_meta ADD COLUMN my_player_name TEXT NOT NULL DEFAULT '自分'")
    if "opponent_player_name" not in columns:
        cur.execute("ALTER TABLE match_meta ADD COLUMN opponent_player_name TEXT NOT NULL DEFAULT '相手'")
    conn.commit()
    conn.close()


def _ensure_index_schema() -> None:
    """インデックス DB の追加カラムを補完する。
    """
    conn = _index_conn()
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(matches)")
    columns = {row[1] for row in cur.fetchall()}
    if "initial_server" not in columns:
        cur.execute("ALTER TABLE matches ADD COLUMN initial_server TEXT NOT NULL DEFAULT 'me'")
    if "my_player_name" not in columns:
        cur.execute("ALTER TABLE matches ADD COLUMN my_player_name TEXT NOT NULL DEFAULT '自分'")
    if "opponent_player_name" not in columns:
        cur.execute("ALTER TABLE matches ADD COLUMN opponent_player_name TEXT NOT NULL DEFAULT '相手'")
    conn.commit()
    conn.close()


def _fetch_match_row(match_ref: int | str) -> sqlite3.Row | None:
    """ID または UUID から試合行を取得する。

    Parameters
    ----------
    match_ref : int | str
        対象試合の ID または UUID。

    Returns
    -------
    sqlite3.Row | None
        該当行。存在しない場合は None。
    """
    _ensure_index_schema()
    conn = _index_conn()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    if isinstance(match_ref, int):
        cur.execute(
            "SELECT id, uuid, title, initial_server, my_player_name, opponent_player_name, created_at FROM matches WHERE id = ?",
            (match_ref,),
        )
    else:
        cur.execute(
            "SELECT id, uuid, title, initial_server, my_player_name, opponent_player_name, created_at FROM matches WHERE uuid = ?",
            (match_ref,),
        )
    row = cur.fetchone()
    conn.close()
    if row:
        _init_match_db(str(row["uuid"]))
    return row


def fetch_matches() -> pd.DataFrame:
    """保存済みの試合一覧を取得する。

    Returns
    -------
    pd.DataFrame
        取得したデータを格納した DataFrame。
    """
    _ensure_index_schema()
    conn = _index_conn()
    df = pd.read_sql_query(
        "SELECT id, uuid, title, initial_server, my_player_name, opponent_player_name, created_at FROM matches ORDER BY id DESC",
        conn,
    )
    conn.close()
    return df


def fetch_tag_definitions() -> pd.DataFrame:
    """タグ定義一覧を取得する。

    Returns
    -------
    pd.DataFrame
        取得したデータを格納した DataFrame。
    """
    conn = _index_conn()
    df = pd.read_sql_query(
        """
        SELECT id, tag, player_side, phase, shot_type, created_at, updated_at
        FROM tag_definitions
        ORDER BY id ASC
        """,
        conn,
    )
    conn.close()
    return df


def fetch_tag_definition(tag_id: int) -> dict[str, Any] | None:
    """タグ定義を 1 件取得する。

    Parameters
    ----------
    tag_id : int
        対象タグ定義の ID。

    Returns
    -------
    dict[str, Any] | None
        該当データ。存在しない場合は None。
    """
    conn = _index_conn()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, tag, player_side, phase, shot_type, created_at, updated_at
        FROM tag_definitions
        WHERE id = ?
        """,
        (tag_id,),
    )
    row = cur.fetchone()
    conn.close()
    return _serialize_tag_definition(dict(row)) if row else None


def create_tag_definition(data: dict[str, Any]) -> dict[str, Any]:
    """タグ定義を作成する。

    Parameters
    ----------
    data : dict[str, Any]
        登録または更新するデータ。

    Returns
    -------
    dict[str, Any]
        処理結果を表す辞書。
    """
    now = datetime.now().isoformat(timespec="seconds")
    conn = _index_conn()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO tag_definitions (tag, player_side, phase, shot_type, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            str(data["tag"]).strip(),
            str(data.get("player_side", "me")),
            str(data.get("phase", "rally")),
            str(data.get("shot_type", "miss")),
            now,
            now,
        ),
    )
    tag_id = int(cur.lastrowid)
    conn.commit()
    conn.close()
    return fetch_tag_definition(tag_id)


def update_tag_definition(tag_id: int, fields: dict[str, Any]) -> dict[str, Any] | None:
    """タグ定義の指定フィールドを更新する。

    Parameters
    ----------
    tag_id : int
        対象タグ定義の ID。
    fields : dict[str, Any]
        更新対象フィールドと値の辞書。

    Returns
    -------
    dict[str, Any] | None
        該当データ。存在しない場合は None。
    """
    allowed = {"tag", "player_side", "phase", "shot_type"}
    updates = {key: value for key, value in fields.items() if key in allowed}
    if "tag" in updates:
        updates["tag"] = str(updates["tag"]).strip()
    if not updates:
        return fetch_tag_definition(tag_id)
    updates["updated_at"] = datetime.now().isoformat(timespec="seconds")
    conn = _index_conn()
    cur = conn.cursor()
    cols = ", ".join(f"{key} = ?" for key in updates)
    cur.execute(f"UPDATE tag_definitions SET {cols} WHERE id = ?", [*updates.values(), tag_id])
    updated = cur.rowcount > 0
    conn.commit()
    conn.close()
    return fetch_tag_definition(tag_id) if updated else None


def delete_tag_definition(tag_id: int) -> bool:
    """タグ定義を削除する。

    Parameters
    ----------
    tag_id : int
        対象タグ定義の ID。

    Returns
    -------
    bool
        処理に成功した場合は True。
    """
    conn = _index_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM tag_definitions WHERE id = ?", (tag_id,))
    deleted = cur.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


def _serialize_tag_definition(row: dict[str, Any]) -> dict[str, Any]:
    """タグ定義の DB 行を API 用辞書へ変換する。

    Parameters
    ----------
    row : dict[str, Any]
        DB から取得した行データ。

    Returns
    -------
    dict[str, Any]
        処理結果を表す辞書。
    """
    return {
        "id": int(row["id"]),
        "tag": str(row["tag"]),
        "player_side": str(row["player_side"]),
        "phase": str(row["phase"]),
        "shot_type": str(row["shot_type"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def fetch_match(match_ref: int | str) -> dict[str, Any] | None:
    """指定した試合情報を取得する。

    Parameters
    ----------
    match_ref : int | str
        対象試合の ID または UUID。

    Returns
    -------
    dict[str, Any] | None
        該当データ。存在しない場合は None。
    """
    row = _fetch_match_row(match_ref)
    return dict(row) if row else None


def create_match(
    title: str,
    match_uuid: str | None = None,
    created_at: str | None = None,
    initial_server: str = "me",
    my_player_name: str = "自分",
    opponent_player_name: str = "相手",
) -> int:
    """新しい試合を作成し、識別子を返す。

    Parameters
    ----------
    title : str
        試合または動画のタイトル。
    match_uuid : str | None
        対象試合の UUID。
    created_at : str | None
        created_at の値。
    initial_server : str
        試合開始時のサーバー。
    my_player_name : str
        自分側の表示名。
    opponent_player_name : str
        相手側の表示名。

    Returns
    -------
    int
        作成されたレコードの ID。
    """
    match_uuid = match_uuid or str(uuid.uuid4())
    created_at = created_at or datetime.now().isoformat(timespec="seconds")
    conn = _index_conn()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO matches (
            uuid,
            title,
            initial_server,
            my_player_name,
            opponent_player_name,
            created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        (match_uuid, title, initial_server, my_player_name, opponent_player_name, created_at),
    )
    match_id = cur.lastrowid
    conn.commit()
    conn.close()

    _init_match_db(match_uuid)
    match_conn = _match_conn(match_uuid)
    match_cur = match_conn.cursor()
    match_cur.execute(
        """
        INSERT OR REPLACE INTO match_meta (
            uuid,
            title,
            initial_server,
            my_player_name,
            opponent_player_name,
            created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        (match_uuid, title, initial_server, my_player_name, opponent_player_name, created_at),
    )
    match_conn.commit()
    match_conn.close()
    return int(match_id)


def delete_match(match_ref: int | str) -> bool:
    """指定した試合と試合 DB ファイルを削除する。

    Parameters
    ----------
    match_ref : int | str
        対象試合の ID または UUID。

    Returns
    -------
    bool
        処理に成功した場合は True。
    """
    row = _fetch_match_row(match_ref)
    if not row:
        return False
    conn = _index_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM matches WHERE uuid = ?", (row["uuid"],))
    conn.commit()
    conn.close()
    _match_db_path(row["uuid"]).unlink(missing_ok=True)
    return True


def _sort_key(row: sqlite3.Row | dict[str, Any]) -> tuple[float, int]:
    """ラリー行の並び替えキーを作成する。

    Parameters
    ----------
    row : sqlite3.Row | dict[str, Any]
        DB から取得した行データ。

    Returns
    -------
    tuple[float, int]
        並び替え用のキー。
    """
    sort_order = row["sort_order"] if isinstance(row, sqlite3.Row) else row.get("sort_order")
    rally_id = row["id"] if isinstance(row, sqlite3.Row) else row.get("id", 0)
    return (float(sort_order or rally_id or 0), int(rally_id or 0))


def _list_rallies_raw(match_uuid: str) -> list[sqlite3.Row]:
    """指定した試合 DB からラリー行を生のまま取得する。

    Parameters
    ----------
    match_uuid : str
        対象試合の UUID。

    Returns
    -------
    list[sqlite3.Row]
        処理結果。
    """
    conn = _match_conn(match_uuid)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(
        """
        SELECT
            id,
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
    )
    rows = cur.fetchall()
    conn.close()
    return rows


def _first_server_for_set(set_no: int, initial_server: str) -> str:
    """セット開始時のサーバーを算出する。

    Parameters
    ----------
    set_no : int
        セット番号。
    initial_server : str
        試合開始時のサーバー。

    Returns
    -------
    str
        処理結果。
    """
    if set_no % 2 == 1:
        return initial_server
    return "op" if initial_server == "me" else "me"


def _expected_server_for_index(index: int, set_no: int, initial_server: str) -> str:
    """セット内のラリー順に対応する期待サーバーを算出する。

    Parameters
    ----------
    index : int
        セット内でのラリー順序。
    set_no : int
        セット番号。
    initial_server : str
        試合開始時のサーバー。

    Returns
    -------
    str
        処理結果。
    """
    first_server = _first_server_for_set(set_no, initial_server)
    if (index // 2) % 2 == 0:
        return first_server
    return "op" if first_server == "me" else "me"


def _normalize_servers(match_uuid: str, set_nos: set[int] | None = None) -> None:
    """セット内のラリー順に合わせてサーバー情報を補正する。

    Parameters
    ----------
    match_uuid : str
        対象試合の UUID。
    set_nos : set[int] | None
        補正対象のセット番号集合。
    """
    match = fetch_match(match_uuid)
    initial_server = str(match.get("initial_server") or "me") if match else "me"
    rows = [dict(row) for row in _list_rallies_raw(match_uuid)]
    grouped: dict[int, list[dict[str, Any]]] = {}
    for row in rows:
        grouped.setdefault(int(row["set_no"]), []).append(row)

    conn = _match_conn(match_uuid)
    cur = conn.cursor()
    changed = False
    for set_no, rallies in grouped.items():
        if set_nos is not None and set_no not in set_nos:
            continue
        rallies.sort(key=_sort_key)
        for index, rally in enumerate(rallies):
            expected_server = _expected_server_for_index(index, set_no, initial_server)
            if rally["server"] != expected_server:
                cur.execute("UPDATE rallies SET server = ? WHERE id = ?", (expected_server, rally["id"]))
                changed = True
    if changed:
        conn.commit()
    conn.close()


def fetch_rallies(match_ref: int | str) -> pd.DataFrame:
    """指定した試合のラリー一覧を取得する。

    Parameters
    ----------
    match_ref : int | str
        対象試合の ID または UUID。

    Returns
    -------
    pd.DataFrame
        取得したデータを格納した DataFrame。
    """
    row = _fetch_match_row(match_ref)
    if not row:
        return pd.DataFrame()
    if row["uuid"] in SERVER_ROTATION_MIGRATION_MATCH_UUIDS:
        _normalize_servers(row["uuid"])
    records = [_serialize_rally(dict(r), row["id"], row["uuid"]) for r in _list_rallies_raw(row["uuid"])]
    return pd.DataFrame(records)


def _parse_result_tags(value: str | None) -> list[str]:
    """result_tag カラムの値をタグ文字列リストへ変換する。

    Parameters
    ----------
    value : str | None
        変換対象の値。

    Returns
    -------
    list[str]
        文字列のリスト。
    """
    if not value:
        return []
    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return [str(t) for t in parsed if t]
        return [str(parsed)] if parsed else []
    except (json.JSONDecodeError, ValueError):
        return [value]


def _serialize_rally(row: dict[str, Any], match_id: int, match_uuid: str) -> dict[str, Any]:
    """ラリーの DB 行を API 用辞書へ変換する。

    Parameters
    ----------
    row : dict[str, Any]
        DB から取得した行データ。
    match_id : int
        対象試合の ID。
    match_uuid : str
        対象試合の UUID。

    Returns
    -------
    dict[str, Any]
        処理結果を表す辞書。
    """
    return {
        "id": row["id"],
        "uuid": row["uuid"],
        "match_id": match_id,
        "match_uuid": match_uuid,
        "sort_order": row["sort_order"],
        "starred": bool(row["starred"]),
        "set_no": row["set_no"],
        "server": row["server"],
        "serve_type": row["serve_type"],
        "receive_type": row["receive_type"],
        "rally_len_bucket": row["rally_len_bucket"],
        "point_winner": row["point_winner"],
        "end_reason": row["end_reason"],
        "end_side": row["end_side"],
        "my_3rd": row["my_3rd"],
        "my_3rd_result": row["my_3rd_result"],
        "result_tags": _parse_result_tags(row["result_tag"]),
        "t_start": row["t_start"],
        "t_end": row["t_end"],
        "note": row["note"],
        "created_at": row["created_at"],
    }


def _next_sort_order(match_uuid: str, insert_after_rally_id: int | None = None) -> float:
    """新規ラリーに割り当てる sort_order を算出する。

    Parameters
    ----------
    match_uuid : str
        対象試合の UUID。
    insert_after_rally_id : int | None
        このラリー ID の後ろに挿入するための基準 ID。

    Returns
    -------
    float
        計算された数値。
    """
    rallies = [dict(row) for row in _list_rallies_raw(match_uuid)]
    if not rallies:
        return 1.0
    if insert_after_rally_id is None:
        last = rallies[-1]
        return float(last["sort_order"] or last["id"]) + 1.0

    anchor_index = next((idx for idx, rally in enumerate(rallies) if rally["id"] == insert_after_rally_id), -1)
    if anchor_index == -1:
        last = rallies[-1]
        return float(last["sort_order"] or last["id"]) + 1.0

    current_order = float(rallies[anchor_index]["sort_order"] or rallies[anchor_index]["id"])
    next_row = rallies[anchor_index + 1] if anchor_index + 1 < len(rallies) else None
    if not next_row:
        return current_order + 1.0
    next_order = float(next_row["sort_order"] or next_row["id"])
    candidate = current_order + (next_order - current_order) / 2.0
    if candidate == current_order or candidate == next_order:
        _rebalance_sort_orders(match_uuid)
        return _next_sort_order(match_uuid, insert_after_rally_id)
    return candidate


def _rebalance_sort_orders(match_uuid: str) -> None:
    """ラリーの sort_order を連番へ再配置する。

    Parameters
    ----------
    match_uuid : str
        対象試合の UUID。
    """
    rows = [dict(row) for row in _list_rallies_raw(match_uuid)]
    conn = _match_conn(match_uuid)
    cur = conn.cursor()
    for index, row in enumerate(rows, start=1):
        if float(row["sort_order"] or 0) != float(index):
            cur.execute("UPDATE rallies SET sort_order = ? WHERE id = ?", (float(index), row["id"]))
    conn.commit()
    conn.close()


def insert_rally(
    match_ref: int | str,
    data: dict[str, Any],
    insert_after_rally_id: int | None = None,
    sort_order: float | None = None,
) -> dict[str, Any]:
    """指定した試合にラリー記録を追加する。

    Parameters
    ----------
    match_ref : int | str
        対象試合の ID または UUID。
    data : dict[str, Any]
        登録または更新するデータ。
    insert_after_rally_id : int | None
        このラリー ID の後ろに挿入するための基準 ID。
    sort_order : float | None
        ラリーの並び順。

    Returns
    -------
    dict[str, Any]
        処理結果を表す辞書。
    """
    match = _fetch_match_row(match_ref)
    if not match:
        raise ValueError("match not found")
    match_uuid = match["uuid"]
    sort_order = sort_order if sort_order is not None else _next_sort_order(match_uuid, insert_after_rally_id)
    rally_uuid = str(uuid.uuid4())
    conn = _match_conn(match_uuid)
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO rallies (
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            rally_uuid,
            sort_order,
            int(bool(data.get("starred", False))),
            data["set_no"],
            data["server"],
            data.get("serve_type"),
            data["receive_type"],
            data["rally_len_bucket"],
            data["point_winner"],
            data["end_reason"],
            data["end_side"],
            data.get("my_3rd"),
            data.get("my_3rd_result"),
            data.get("result_tag"),
            data.get("t_start"),
            data.get("t_end"),
            data.get("note"),
            data["created_at"],
        ),
    )
    rally_id = cur.lastrowid
    conn.commit()
    conn.close()
    _normalize_servers(match_uuid, {int(data["set_no"])})
    return fetch_rally(match_uuid, int(rally_id))


def fetch_rally(match_ref: int | str, rally_id: int) -> dict[str, Any] | None:
    """指定したラリーを 1 件取得する。

    Parameters
    ----------
    match_ref : int | str
        対象試合の ID または UUID。
    rally_id : int
        対象ラリーの ID。

    Returns
    -------
    dict[str, Any] | None
        該当データ。存在しない場合は None。
    """
    match = _fetch_match_row(match_ref)
    if not match:
        return None
    conn = _match_conn(match["uuid"])
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT * FROM rallies WHERE id = ?", (rally_id,))
    row = cur.fetchone()
    conn.close()
    return _serialize_rally(dict(row), match["id"], match["uuid"]) if row else None


def delete_last_rally(match_ref: int | str) -> bool:
    """指定した試合の直近ラリーを削除する。

    Parameters
    ----------
    match_ref : int | str
        対象試合の ID または UUID。

    Returns
    -------
    bool
        処理に成功した場合は True。
    """
    match = _fetch_match_row(match_ref)
    if not match:
        return False
    rallies = _list_rallies_raw(match["uuid"])
    if not rallies:
        return False
    last_id = sorted(rallies, key=_sort_key)[-1]["id"]
    return delete_rally(match["uuid"], int(last_id))


def delete_rally(match_ref: int | str, rally_id: int) -> bool:
    """指定したラリーを削除する。

    Parameters
    ----------
    match_ref : int | str
        対象試合の ID または UUID。
    rally_id : int
        対象ラリーの ID。

    Returns
    -------
    bool
        処理に成功した場合は True。
    """
    match = _fetch_match_row(match_ref)
    if not match:
        return False
    rally = fetch_rally(match["uuid"], rally_id)
    affected_set_no = int(rally["set_no"]) if rally else None
    conn = _match_conn(match["uuid"])
    cur = conn.cursor()
    cur.execute("DELETE FROM rallies WHERE id = ?", (rally_id,))
    deleted = cur.rowcount > 0
    conn.commit()
    conn.close()
    if deleted and affected_set_no is not None:
        _normalize_servers(match["uuid"], {affected_set_no})
    return deleted


def update_rally_fields(match_ref: int | str, rally_id: int, fields: dict[str, Any]) -> dict[str, Any] | None:
    """ラリーの指定フィールドを更新する。

    Parameters
    ----------
    match_ref : int | str
        対象試合の ID または UUID。
    rally_id : int
        対象ラリーの ID。
    fields : dict[str, Any]
        更新対象フィールドと値の辞書。

    Returns
    -------
    dict[str, Any] | None
        該当データ。存在しない場合は None。
    """
    match = _fetch_match_row(match_ref)
    if not match or not fields:
        return fetch_rally(match_ref, rally_id)
    current_rally = fetch_rally(match["uuid"], rally_id)
    allowed = {
        "set_no",
        "result_tag",
        "result_tags",
        "point_winner",
        "sort_order",
        "starred",
        "serve_type",
        "receive_type",
        "rally_len_bucket",
        "end_reason",
        "end_side",
        "my_3rd",
        "my_3rd_result",
        "t_start",
        "t_end",
        "note",
    }
    updates = {key: value for key, value in fields.items() if key in allowed}
    if "starred" in updates:
        updates["starred"] = int(bool(updates["starred"]))
    if "result_tags" in updates:
        tags = updates.pop("result_tags")
        updates["result_tag"] = json.dumps(tags) if tags else None
    if not updates:
        return fetch_rally(match_ref, rally_id)

    conn = _match_conn(match["uuid"])
    cur = conn.cursor()
    cols = ", ".join(f"{key} = ?" for key in updates)
    cur.execute(f"UPDATE rallies SET {cols} WHERE id = ?", [*updates.values(), rally_id])
    conn.commit()
    conn.close()
    affected_set_nos = set()
    if current_rally:
        affected_set_nos.add(int(current_rally["set_no"]))
    if "set_no" in updates and updates["set_no"] is not None:
        affected_set_nos.add(int(updates["set_no"]))
    if affected_set_nos:
        _normalize_servers(match["uuid"], affected_set_nos)
    return fetch_rally(match_ref, rally_id)


def bulk_update_sort_orders(match_ref: int | str, orders: list[dict[str, Any]]) -> None:
    """複数ラリーの sort_order を一括更新する。

    Parameters
    ----------
    match_ref : int | str
        対象試合の ID または UUID。
    orders : list[dict[str, Any]]
        ラリー ID と sort_order のリスト。
    """
    match = _fetch_match_row(match_ref)
    if not match:
        raise ValueError("match not found")
    conn = _match_conn(match["uuid"])
    cur = conn.cursor()
    for item in orders:
        cur.execute(
            "UPDATE rallies SET sort_order = ? WHERE id = ?",
            (float(item["sort_order"]), int(item["id"])),
        )
    conn.commit()
    conn.close()


def update_match(
    match_ref: int | str,
    *,
    title: str | None = None,
    initial_server: str | None = None,
    my_player_name: str | None = None,
    opponent_player_name: str | None = None,
) -> dict[str, Any] | None:
    """試合のタイトルまたは初期サーバーを更新する。

    Parameters
    ----------
    match_ref : int | str
        対象試合の ID または UUID。
    title : str | None
        試合または動画のタイトル。
    initial_server : str | None
        試合開始時のサーバー。
    my_player_name : str | None
        自分側の表示名。
    opponent_player_name : str | None
        相手側の表示名。

    Returns
    -------
    dict[str, Any] | None
        該当データ。存在しない場合は None。
    """
    match = _fetch_match_row(match_ref)
    if not match:
        return None
    next_title = title or match["title"]
    next_initial_server = initial_server or match["initial_server"] or "me"
    next_my_player_name = my_player_name or match["my_player_name"] or "自分"
    next_opponent_player_name = opponent_player_name or match["opponent_player_name"] or "相手"

    conn = _index_conn()
    cur = conn.cursor()
    cur.execute(
        """
        UPDATE matches
        SET title = ?,
            initial_server = ?,
            my_player_name = ?,
            opponent_player_name = ?
        WHERE uuid = ?
        """,
        (next_title, next_initial_server, next_my_player_name, next_opponent_player_name, match["uuid"]),
    )
    conn.commit()
    conn.close()

    match_conn = _match_conn(match["uuid"])
    match_cur = match_conn.cursor()
    match_cur.execute(
        """
        UPDATE match_meta
        SET title = ?,
            initial_server = ?,
            my_player_name = ?,
            opponent_player_name = ?
        WHERE uuid = ?
        """,
        (next_title, next_initial_server, next_my_player_name, next_opponent_player_name, match["uuid"]),
    )
    match_conn.commit()
    match_conn.close()

    if initial_server is not None:
        _normalize_servers(match["uuid"])
    return fetch_match(match["uuid"])


def fetch_match_input_state(match_ref: int | str) -> dict[str, Any] | None:
    """試合入力画面の保存状態を取得する。

    Parameters
    ----------
    match_ref : int | str
        対象試合の ID または UUID。

    Returns
    -------
    dict[str, Any] | None
        該当データ。存在しない場合は None。
    """
    match = _fetch_match_row(match_ref)
    if not match:
        return None
    conn = _match_conn(match["uuid"])
    cur = conn.cursor()
    cur.execute("SELECT state_json FROM input_state WHERE match_uuid = ?", (match["uuid"],))
    row = cur.fetchone()
    conn.close()
    if not row:
        return None
    return json.loads(row[0])


def save_match_input_state(match_ref: int | str, state: dict[str, Any]) -> None:
    """試合入力画面の状態を保存する。

    Parameters
    ----------
    match_ref : int | str
        対象試合の ID または UUID。
    state : dict[str, Any]
        保存する入力状態。
    """
    match = _fetch_match_row(match_ref)
    if not match:
        raise ValueError("match not found")
    conn = _match_conn(match["uuid"])
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO input_state (match_uuid, state_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(match_uuid) DO UPDATE SET
            state_json = excluded.state_json,
            updated_at = excluded.updated_at
        """,
        (match["uuid"], json.dumps(state, ensure_ascii=False), datetime.now().isoformat(timespec="seconds")),
    )
    conn.commit()
    conn.close()
