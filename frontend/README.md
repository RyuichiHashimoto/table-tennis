# Frontend (Angular)

`backend/app.py` の主要UIを Angular へ移植したフロント実装です。

## 起動

```bash
cd frontend
npm install
npm start
```

デフォルトは `http://localhost:4200`。

## 注意

- この段階では **frontend-only** 実装です。
- クリッピング実処理（ffmpeg 実行）は API 連携時に有効化してください。
- 現在はローカルストレージに試合・ラリーデータを保存します。
