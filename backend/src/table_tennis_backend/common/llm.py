"""LLM による試合プレー解析の共通処理。"""

from __future__ import annotations

import base64
import json
import mimetypes
import os
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Sequence


OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
DEFAULT_MODEL = "gpt-4.1"
DEFAULT_TIMEOUT_SEC = 180


class LlmAnalysisError(RuntimeError):
    """LLM 解析に失敗したことを表す例外。"""


@dataclass(frozen=True)
class PlayAnalysis:
    """1 プレー分の LLM 解析結果。"""

    start_sec: float | None
    end_sec: float | None
    time_label: str
    score: str
    point_winner: str
    result: str
    content: str
    confidence: float | None = None


def analyze_match_plays_with_llm(
    video_data_file_path: str | Path,
    match_sql_result: Sequence[Mapping[str, Any]] | Any,
    *,
    api_key: str | None = None,
    model: str | None = None,
    timeout_sec: int = DEFAULT_TIMEOUT_SEC,
) -> list[PlayAnalysis]:
    """動画ファイルと試合 SQL 結果から各プレーの解析結果を返す。

    Parameters
    ----------
    video_data_file_path : str | Path
        解析対象の動画データファイルパス。
    match_sql_result : Sequence[Mapping[str, Any]] | Any
        SQL 実行結果。dict のリスト、または pandas DataFrame を想定する。
    api_key : str | None
        OpenAI API キー。未指定時は ``OPENAI_API_KEY`` を使う。
    model : str | None
        使用モデル。未指定時は ``OPENAI_MODEL``、さらに未指定なら ``gpt-4.1``。
    timeout_sec : int
        HTTP リクエストタイムアウト秒数。

    Returns
    -------
    list[PlayAnalysis]
        各プレーの時間、対戦結果、内容。
    """
    key = api_key or os.getenv("OPENAI_API_KEY")
    if not key:
        raise LlmAnalysisError("OPENAI_API_KEY is required")

    video_path = Path(video_data_file_path)
    if not video_path.is_file():
        raise LlmAnalysisError(f"video file not found: {video_path}")

    records = _normalize_sql_result(match_sql_result)
    payload = _build_responses_payload(
        video_path=video_path,
        match_records=records,
        model=model or os.getenv("OPENAI_MODEL") or DEFAULT_MODEL,
    )
    response = _post_json(OPENAI_RESPONSES_URL, payload, key, timeout_sec)
    output_text = _extract_output_text(response)
    return _parse_play_analyses(output_text)


def _normalize_sql_result(match_sql_result: Sequence[Mapping[str, Any]] | Any) -> list[dict[str, Any]]:
    if hasattr(match_sql_result, "where") and hasattr(match_sql_result, "to_dict"):
        import pandas as pd

        df = match_sql_result
        if df.empty:
            return []
        return df.where(pd.notnull(df), None).to_dict(orient="records")
    if isinstance(match_sql_result, Mapping):
        return [dict(match_sql_result)]
    return [dict(row) for row in match_sql_result]


def _build_responses_payload(video_path: Path, match_records: list[dict[str, Any]], model: str) -> dict[str, Any]:
    mime_type = mimetypes.guess_type(video_path.name)[0] or "application/octet-stream"
    video_data = base64.b64encode(video_path.read_bytes()).decode("ascii")
    match_json = json.dumps(match_records, ensure_ascii=False, indent=2, default=str)

    return {
        "model": model,
        "instructions": (
            "あなたは卓球の試合映像と記録データを照合する分析アシスタントです。"
            "映像とSQL結果から各プレーを確認し、時間、対戦結果、内容を日本語で返してください。"
            "不明な項目は推測で埋めず、null または短く「不明」としてください。"
        ),
        "input": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": (
                            "以下の動画ファイルと試合SQL結果を照合して、各プレーを抽出してください。\n\n"
                            "返答は必ず JSON のみで、plays 配列を持つ形式にしてください。\n"
                            "各 play は start_sec, end_sec, time_label, score, point_winner, result, "
                            "content, confidence を持ってください。\n\n"
                            f"SQL_RESULT:\n{match_json}"
                        ),
                    },
                    {
                        "type": "input_file",
                        "filename": video_path.name,
                        "file_data": f"data:{mime_type};base64,{video_data}",
                    },
                ],
            }
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "table_tennis_play_analysis",
                "schema": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "plays": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "additionalProperties": False,
                                "properties": {
                                    "start_sec": {"type": ["number", "null"]},
                                    "end_sec": {"type": ["number", "null"]},
                                    "time_label": {"type": "string"},
                                    "score": {"type": "string"},
                                    "point_winner": {"type": "string"},
                                    "result": {"type": "string"},
                                    "content": {"type": "string"},
                                    "confidence": {"type": ["number", "null"]},
                                },
                                "required": [
                                    "start_sec",
                                    "end_sec",
                                    "time_label",
                                    "score",
                                    "point_winner",
                                    "result",
                                    "content",
                                    "confidence",
                                ],
                            },
                        }
                    },
                    "required": ["plays"],
                },
            }
        },
    }


def _post_json(url: str, payload: dict[str, Any], api_key: str, timeout_sec: int) -> dict[str, Any]:
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_sec) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise LlmAnalysisError(f"LLM API request failed: {exc.code} {detail}") from exc
    except urllib.error.URLError as exc:
        raise LlmAnalysisError(f"LLM API request failed: {exc.reason}") from exc


def _extract_output_text(response: Mapping[str, Any]) -> str:
    texts: list[str] = []
    for item in response.get("output", []):
        if item.get("type") != "message":
            continue
        for content in item.get("content", []):
            if content.get("type") == "output_text":
                texts.append(str(content.get("text", "")))
    output_text = "".join(texts).strip()
    if not output_text:
        raise LlmAnalysisError("LLM API response did not include output text")
    return output_text


def _parse_play_analyses(output_text: str) -> list[PlayAnalysis]:
    try:
        data = json.loads(output_text)
    except json.JSONDecodeError as exc:
        raise LlmAnalysisError("LLM output was not valid JSON") from exc

    plays = data.get("plays")
    if not isinstance(plays, list):
        raise LlmAnalysisError("LLM output JSON must include a plays array")

    return [
        PlayAnalysis(
            start_sec=_optional_float(play.get("start_sec")),
            end_sec=_optional_float(play.get("end_sec")),
            time_label=str(play.get("time_label") or ""),
            score=str(play.get("score") or ""),
            point_winner=str(play.get("point_winner") or ""),
            result=str(play.get("result") or ""),
            content=str(play.get("content") or ""),
            confidence=_optional_float(play.get("confidence")),
        )
        for play in plays
        if isinstance(play, Mapping)
    ]


def _optional_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    return float(value)


__all__ = [
    "LlmAnalysisError",
    "PlayAnalysis",
    "analyze_match_plays_with_llm",
]
