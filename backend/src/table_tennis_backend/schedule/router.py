import os
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException

from table_tennis_backend.schedule.crawler import crawl_schedule
from table_tennis_backend.schedule.store import fetch_scheduled_matches, upsert_scheduled_matches

router = APIRouter(prefix="/schedule", tags=["schedule"])


@router.get("")
def list_schedule() -> list[dict[str, Any]]:
    return fetch_scheduled_matches()


@router.post("/refresh")
def refresh_schedule() -> dict[str, Any]:
    source_url = os.getenv("SCHEDULE_SOURCE_URL", "").strip()
    if not source_url:
        raise HTTPException(status_code=503, detail="SCHEDULE_SOURCE_URL is not configured")
    try:
        imported = upsert_scheduled_matches(source_url, crawl_schedule(source_url))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"schedule crawl failed: {exc}") from exc
    return {"imported": imported, "fetched_at": datetime.now(timezone.utc).isoformat(), "source_url": source_url}
