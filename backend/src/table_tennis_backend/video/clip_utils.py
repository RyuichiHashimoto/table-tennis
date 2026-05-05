import pandas as pd


def build_rally_clip_segments(
    rallies_df: pd.DataFrame,
    scope_start_sec: float | None = None,
    scope_end_sec: float | None = None,
) -> list[dict]:
    """ラリー記録からクリップ切り出し用の区間一覧を作成する。

    Parameters
    ----------
    rallies_df : pd.DataFrame
        ラリー記録を含む DataFrame。
    scope_start_sec : float | None
        対象に含める開始時刻（秒）。
    scope_end_sec : float | None
        対象に含める終了時刻（秒）。

    Returns
    -------
    list[dict]
        区間またはレコードを表す辞書のリスト。
    """
    if rallies_df.empty:
        return []

    rows = rallies_df.copy()
    rows["t_start"] = pd.to_numeric(rows["t_start"], errors="coerce")
    rows["t_end"] = pd.to_numeric(rows["t_end"], errors="coerce")
    rows = rows.dropna(subset=["t_start", "t_end"])
    rows = rows[rows["t_end"] > rows["t_start"]]

    if scope_start_sec is not None:
        rows = rows[rows["t_start"] >= float(scope_start_sec)]
    if scope_end_sec is not None:
        rows = rows[rows["t_end"] <= float(scope_end_sec)]

    rows = rows.sort_values(["t_start", "id"])
    return [
        {
            "rally_id": int(r["id"]),
            "set_no": int(r["set_no"]),
            "start_sec": round(float(r["t_start"]), 2),
            "end_sec": round(float(r["t_end"]), 2),
            "duration_sec": round(float(r["t_end"] - r["t_start"]), 2),
        }
        for _, r in rows.iterrows()
    ]


def build_set_segments_from_rallies(rally_segments: list[dict]) -> list[dict]:
    """ラリー区間をセット単位の区間へ集約する。

    Parameters
    ----------
    rally_segments : list[dict]
        ラリー区間を表す辞書のリスト。

    Returns
    -------
    list[dict]
        区間またはレコードを表す辞書のリスト。
    """
    if not rally_segments:
        return []
    df = pd.DataFrame(rally_segments)
    grouped = (
        df.groupby("set_no", as_index=False)
        .agg(start_sec=("start_sec", "min"), end_sec=("end_sec", "max"))
        .sort_values("set_no")
    )
    grouped["duration_sec"] = grouped["end_sec"] - grouped["start_sec"]
    grouped = grouped[grouped["duration_sec"] > 0]
    return grouped.round(2).to_dict(orient="records")


def build_set_segments_from_boundaries(clip_duration_sec: float, boundaries: list[float]) -> list[dict]:
    """境界時刻からセット単位の区間一覧を作成する。

    Parameters
    ----------
    clip_duration_sec : float
        クリップ全体の長さ（秒）。
    boundaries : list[float]
        区間境界の時刻（秒）のリスト。

    Returns
    -------
    list[dict]
        区間またはレコードを表す辞書のリスト。
    """
    marks = sorted({round(float(x), 2) for x in boundaries if 0.0 < float(x) < clip_duration_sec})
    points = [0.0, *marks, round(float(clip_duration_sec), 2)]
    segments = []
    for i in range(len(points) - 1):
        start_sec = float(points[i])
        end_sec = float(points[i + 1])
        if end_sec <= start_sec:
            continue
        segments.append(
            {
                "set_no": i + 1,
                "start_sec": round(start_sec, 2),
                "end_sec": round(end_sec, 2),
                "duration_sec": round(end_sec - start_sec, 2),
            }
        )
    return segments
