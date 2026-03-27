# TT Analyzer API (FastAPI)

## Run

```bash
docker compose up api
```

- Base URL: `http://localhost:8000`
- Docs: `http://localhost:8000/docs`

## Main endpoints

- `GET /health`
- `GET /matches`
- `POST /matches`
- `GET /matches/{match_id}/rallies`
- `POST /matches/{match_id}/rallies`
- `DELETE /matches/{match_id}/rallies/last`
- `GET /matches/{match_id}/summary`
- `GET /videos`
- `POST /videos/info`
- `POST /videos/download`
- `POST /videos/segments/save`
- `POST /analysis/extract-match-segments`
- `POST /analysis/detect-set-boundaries`
- `POST /clips/export-segments`
- `POST /clips/export-rallies`
- `POST /clips/export-rally`
- `POST /clips/export-sets-from-rallies`
- `POST /clips/export-sets-from-boundaries`

## CORS

`CORS_ALLOW_ORIGINS` env var (comma separated) can be used to set allowed origins.
Default: `*`
