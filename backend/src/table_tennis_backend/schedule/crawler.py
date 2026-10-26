"""設定された JSON エンドポイントから試合予定を収集する。"""

import json
from datetime import datetime, timezone
from typing import Any
from urllib.request import Request, urlopen


def crawl_schedule(source_url: str, timeout: int = 15) -> list[dict[str, Any]]:
    request = Request(source_url, headers={"Accept": "application/json", "User-Agent": "TT-Analyzer-Schedule/1.0"})
    with urlopen(request, timeout=timeout) as response:  # noqa: S310 - URL は管理者設定のみ
        payload = json.load(response)
    rows = payload if isinstance(payload, list) else payload.get("events", payload.get("matches", []))
    if not isinstance(rows, list):
        raise ValueError("schedule source must return an array, or an object containing events/matches")
    return [_normalize(row, source_url, index) for index, row in enumerate(rows) if isinstance(row, dict)]


def _normalize(row: dict[str, Any], source_url: str, index: int) -> dict[str, Any]:
    starts_at = _first(row, "starts_at", "start_at", "startTime", "date", "scheduled_at")
    if not starts_at:
        raise ValueError(f"event {index + 1}: starts_at/date is required")
    parsed = datetime.fromisoformat(str(starts_at).replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    title = _first(row, "title", "name", "event_name", "tournament")
    if not title:
        raise ValueError(f"event {index + 1}: title/name is required")
    external_id = str(_first(row, "id", "external_id", "uuid") or f"{parsed.isoformat()}:{title}")
    return {
        "external_id": external_id, "title": str(title), "starts_at": parsed,
        "venue": str(_first(row, "venue", "location", "place") or ""),
        "competition": str(_first(row, "competition", "league", "category") or ""),
        "source_url": str(_first(row, "url", "source_url", "link") or source_url),
    }


def _first(row: dict[str, Any], *keys: str) -> Any:
    return next((row[key] for key in keys if row.get(key) not in (None, "")), None)
