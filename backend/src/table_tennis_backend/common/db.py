import sqlite3

DB_PATH = "tt_analyzer.db"


def get_conn() -> sqlite3.Connection:
    """SQLite データベースへの接続を作成する。

    Returns
    -------
    sqlite3.Connection
        SQLite 接続オブジェクト。
    """
    return sqlite3.connect(DB_PATH, check_same_thread=False)
