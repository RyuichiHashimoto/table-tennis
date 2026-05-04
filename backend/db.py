import sqlite3
from datetime import datetime
import json

import pandas as pd

DB_PATH = "tt_analyzer.db"


def get_conn():
    """SQLite データベースへの接続を作成する。

    Returns
    -------
    Any
        処理結果。
    """
    return sqlite3.connect(DB_PATH, check_same_thread=False)


def init_db():
    """従来形式のアプリ用データベースを初期化する。
    """
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
    CREATE TABLE IF NOT EXISTS matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """
    )
    cur.execute(
        """
    CREATE TABLE IF NOT EXISTS rallies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_id INTEGER NOT NULL,
        set_no INTEGER NOT NULL,
        server TEXT NOT NULL,                 -- 'me' or 'op'
        serve_type TEXT,                      -- optional
        receive_type TEXT NOT NULL,           -- short/long/flick/push/stop/other
        rally_len_bucket TEXT NOT NULL,       -- '1-2','3-4','5-8','9+'
        point_winner TEXT NOT NULL,           -- 'me' or 'op'
        end_reason TEXT NOT NULL,             -- 'my_miss','op_miss','winner','ace','receive_miss'
        end_side TEXT NOT NULL,               -- 'my_fh','my_bh','my_mid','op_fh','op_bh','op_mid','unknown'
        my_3rd TEXT,                          -- 'attack','keep','none'
        my_3rd_result TEXT,                   -- 'point','continue','miss','na'
        t_start REAL,                         -- optional (sec)
        t_end REAL,                           -- optional (sec)
        note TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(match_id) REFERENCES matches(id)
    )
    """
    )
    cur.execute(
        """
    CREATE TABLE IF NOT EXISTS downloaded_videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id TEXT,
        title TEXT,
        source_url TEXT NOT NULL,
        local_path TEXT NOT NULL UNIQUE,
        uploader TEXT,
        duration INTEGER,
        downloaded_at TEXT NOT NULL
    )
    """
    )
    cur.execute("PRAGMA table_info(downloaded_videos)")
    downloaded_video_columns = {row[1] for row in cur.fetchall()}
    if "match_segments_json" not in downloaded_video_columns:
        cur.execute("ALTER TABLE downloaded_videos ADD COLUMN match_segments_json TEXT")
    if "match_segments_updated_at" not in downloaded_video_columns:
        cur.execute("ALTER TABLE downloaded_videos ADD COLUMN match_segments_updated_at TEXT")
    conn.commit()
    conn.close()


def fetch_matches() -> pd.DataFrame:
    """保存済みの試合一覧を取得する。

    Returns
    -------
    pd.DataFrame
        取得したデータを格納した DataFrame。
    """
    conn = get_conn()
    df = pd.read_sql_query("SELECT id, title, created_at FROM matches ORDER BY id DESC", conn)
    conn.close()
    return df


def create_match(title: str) -> int:
    """新しい試合を作成し、識別子を返す。

    Parameters
    ----------
    title : str
        試合または動画のタイトル。

    Returns
    -------
    int
        作成されたレコードの ID。
    """
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO matches (title, created_at) VALUES (?, ?)",
        (title, datetime.now().isoformat(timespec="seconds")),
    )
    conn.commit()
    match_id = cur.lastrowid
    conn.close()
    return match_id


def insert_rally(match_id: int, data: dict):
    """指定した試合にラリー記録を追加する。

    Parameters
    ----------
    match_id : int
        対象試合の ID。
    data : dict
        登録または更新するデータ。

    Returns
    -------
    Any
        処理結果。
    """
    conn = get_conn()
    cur = conn.cursor()
    cols = ",".join(data.keys())
    qs = ",".join(["?"] * len(data))
    cur.execute(f"INSERT INTO rallies (match_id,{cols}) VALUES (?,{qs})", [match_id, *data.values()])
    conn.commit()
    conn.close()


def fetch_rallies(match_id: int) -> pd.DataFrame:
    """指定した試合のラリー一覧を取得する。

    Parameters
    ----------
    match_id : int
        対象試合の ID。

    Returns
    -------
    pd.DataFrame
        取得したデータを格納した DataFrame。
    """
    conn = get_conn()
    df = pd.read_sql_query(
        "SELECT * FROM rallies WHERE match_id = ? ORDER BY id ASC",
        conn,
        params=(match_id,),
    )
    conn.close()
    return df


def delete_last_rally(match_id: int) -> bool:
    """指定した試合の直近ラリーを削除する。

    Parameters
    ----------
    match_id : int
        対象試合の ID。

    Returns
    -------
    bool
        処理に成功した場合は True。
    """
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id FROM rallies WHERE match_id=? ORDER BY id DESC LIMIT 1", (match_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return False
    last_id = row[0]
    cur.execute("DELETE FROM rallies WHERE id=?", (last_id,))
    conn.commit()
    conn.close()
    return True


def upsert_downloaded_video(
    *,
    source_url: str,
    local_path: str,
    video_id: str | None = None,
    title: str | None = None,
    uploader: str | None = None,
    duration: int | None = None,
) -> None:
    """ダウンロード済み動画のメタデータを登録または更新する。

    Parameters
    ----------
    source_url : str
        元動画の URL。
    local_path : str
        ローカルに保存された動画パス。
    video_id : str | None
        動画サービス上の ID。
    title : str | None
        試合または動画のタイトル。
    uploader : str | None
        動画投稿者名。
    duration : int | None
        動画の長さ（秒）。
    """
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO downloaded_videos
            (video_id, title, source_url, local_path, uploader, duration, downloaded_at)
        VALUES
            (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(local_path) DO UPDATE SET
            video_id=excluded.video_id,
            title=excluded.title,
            source_url=excluded.source_url,
            uploader=excluded.uploader,
            duration=excluded.duration,
            downloaded_at=excluded.downloaded_at
        """,
        (
            video_id,
            title,
            source_url,
            local_path,
            uploader,
            duration,
            datetime.now().isoformat(timespec="seconds"),
        ),
    )
    conn.commit()
    conn.close()


def fetch_downloaded_videos() -> pd.DataFrame:
    """ダウンロード済み動画の一覧を取得する。

    Returns
    -------
    pd.DataFrame
        取得したデータを格納した DataFrame。
    """
    conn = get_conn()
    df = pd.read_sql_query(
        """
        SELECT
            id,
            video_id,
            title,
            source_url,
            local_path,
            uploader,
            duration,
            downloaded_at,
            match_segments_json,
            match_segments_updated_at
        FROM downloaded_videos
        ORDER BY downloaded_at DESC, id DESC
        """,
        conn,
    )
    conn.close()
    return df


def fetch_downloaded_video_by_source_url(source_url: str) -> pd.DataFrame:
    """元 URL に対応するダウンロード済み動画を取得する。

    Parameters
    ----------
    source_url : str
        元動画の URL。

    Returns
    -------
    pd.DataFrame
        取得したデータを格納した DataFrame。
    """
    conn = get_conn()
    df = pd.read_sql_query(
        """
        SELECT
            id,
            video_id,
            title,
            source_url,
            local_path,
            uploader,
            duration,
            downloaded_at,
            match_segments_json,
            match_segments_updated_at
        FROM downloaded_videos
        WHERE source_url = ?
        ORDER BY downloaded_at DESC, id DESC
        LIMIT 1
        """,
        conn,
        params=(source_url,),
    )
    conn.close()
    return df


def update_downloaded_video_segments(local_path: str, segments: list[dict]) -> None:
    """動画に紐づく試合区間情報を保存する。

    Parameters
    ----------
    local_path : str
        ローカルに保存された動画パス。
    segments : list[dict]
        切り出し対象の区間リスト。
    """
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        UPDATE downloaded_videos
        SET match_segments_json = ?, match_segments_updated_at = ?
        WHERE local_path = ?
        """,
        (
            json.dumps(segments, ensure_ascii=False),
            datetime.now().isoformat(timespec="seconds"),
            local_path,
        ),
    )
    conn.commit()
    conn.close()
