# バックエンド固有ルール

> 全体ルールは `../CLAUDE.md` を参照。このファイルはバックエンド作業時に追加で適用される。

---

## 技術スタック

- ランタイム: Python 3.12
- APIフレームワーク: FastAPI + Uvicorn
- バリデーション: Pydantic（FastAPI の `BaseModel`）
- データベース: SQLite（ORM なし、`sqlite3` モジュール直接使用）
- データ操作: pandas（DB読み取り結果の加工）
- 動画処理: yt-dlp（ダウンロード）/ OpenCV（解析）/ ffmpeg（切り抜き）
- パッケージ管理: uv（`pyproject.toml`）
- 認証: なし

---

## ファイル構成

```
backend/
  api.py          # FastAPI アプリ定義 + 全ルートハンドラ
  match_store.py  # 試合/ラリー/タグ の CRUD（メインデータストア）
  db.py           # 旧 Streamlit 用 SQLite + downloaded_videos テーブル
  analytics.py    # 集計ロジック（summarize / scoring_patterns）
  clip_utils.py   # 動画セグメント構築ユーティリティ
  models.py       # RallyInput dataclass + build_rally_input
  video_analysis.py # yt-dlp / OpenCV / ffmpeg ラッパー
  app.py          # Streamlit MVP（旧UIレガシー、参照用）
```

---

## データストア構造

- `match_store.py` → `data/matches/index.sqlite`（試合インデックス） + 試合ごとの JSON ファイル（ラリーデータ）
- `db.py` → `tt_analyzer.db`（`downloaded_videos` テーブルおよびレガシーデータ）

---

## APIルール

- FastAPI の `HTTPException` を使ってエラーを返す
- レスポンスはデータを直接返す（`{success: true, data: ...}` ラッパーは使わない）
- HTTPステータスコードを適切に使う（200/201/400/404/500）

```python
# ✅ 良い例
@app.get("/matches/{match_uuid}")
def get_match_api(match_uuid: str) -> dict[str, Any]:
    match = fetch_match(match_uuid)
    if not match:
        raise HTTPException(status_code=404, detail="match not found")
    return match
```

---

## Pydanticモデルルール

- リクエストボディは `api.py` 内の Pydantic `BaseModel` で定義する
- フィールド名は snake_case
- Optional フィールドにはデフォルト値を設定する

```python
class RallyCreateRequest(BaseModel):
    set_no: int = Field(ge=1, le=7)
    server: str
    note: str = ""
    t_start: float | None = None
```

---

## データベースルール

- SQLは raw sqlite3 で書く（`?` プレースホルダーを必ず使う）
- DB読み取りには `pd.read_sql_query()` を使い、DataFrame として返す
- `None` を含むDataFrame をdictに変換する際は `_safe_records(df)` を使う
- `match_store.py` の関数を通じてデータにアクセスする（`api.py` で直接 sqlite3 を呼ばない）
- マイグレーションは `init_db()` / `init_match_store()` 内の `CREATE TABLE IF NOT EXISTS` と `ALTER TABLE` で行う

```python
# ✅ 良い例（プレースホルダー使用）
cur.execute("SELECT id FROM rallies WHERE match_id=? ORDER BY id DESC LIMIT 1", (match_id,))

# ❌ 悪い例（SQLインジェクション）
cur.execute(f"SELECT * FROM rallies WHERE match_id={match_id}")
```

---

## エラーハンドリング

- FastAPI のルートハンドラ内で例外をキャッチし `HTTPException` に変換する
- 外部ツール（yt-dlp, ffmpeg）の `FileNotFoundError` は `500` で返す
- バリデーションエラーは `400` で返す

```python
try:
    result = some_operation()
except FileNotFoundError as exc:
    raise HTTPException(status_code=500, detail="yt-dlp not found") from exc
except Exception as exc:
    raise HTTPException(status_code=400, detail=str(exc)) from exc
```

---

## CORS設定

- 許可オリジンは環境変数 `CORS_ALLOW_ORIGINS`（カンマ区切り）で設定する
- 未設定時は `"*"` にフォールバックする

---

## 禁止事項（バックエンド）

- `f"... {変数} ..."` 形式の SQL 文字列結合禁止（プレースホルダー `?` を使う）
- `api.py` から直接 sqlite3 を操作しない（`match_store.py` / `db.py` の関数を使う）
- シークレット・APIキーのハードコーディング禁止
- `app.py`（Streamlit）に新機能を追加しない（レガシー参照用）
