import pandas as pd


def rate(numer, denom) -> float:
    """分子と分母から比率を計算する。

    Parameters
    ----------
    numer : Any
        分子。
    denom : Any
        分母。

    Returns
    -------
    float
        計算された数値。
    """
    return float(numer) / float(denom) if denom else 0.0


def summarize(df: pd.DataFrame) -> dict:
    """ラリー記録の基本集計を作成する。

    Parameters
    ----------
    df : pd.DataFrame
        集計対象の DataFrame。

    Returns
    -------
    dict
        処理結果を表す辞書。
    """
    if df.empty:
        return {}

    total = len(df)
    win = (df["point_winner"] == "me").sum()
    lose = total - win

    my_serve = df[df["server"] == "me"]
    op_serve = df[df["server"] == "op"]

    by_len = (
        df.assign(win=(df["point_winner"] == "me").astype(int))
        .groupby("rally_len_bucket")
        .agg(points=("id", "count"), wins=("win", "sum"))
        .reset_index()
    )
    by_len["win_rate"] = by_len.apply(lambda r: rate(r["wins"], r["points"]), axis=1)

    by_reason = df.groupby("end_reason").size().reset_index(name="count")
    by_reason["ratio"] = by_reason["count"].apply(lambda c: rate(c, total))

    third = df[df["my_3rd"].notna() & (df["my_3rd"] != "none")]
    third_attack = third[third["my_3rd"] == "attack"]
    third_attack_point = (third_attack["my_3rd_result"] == "point").sum()
    third_attack_miss = (third_attack["my_3rd_result"] == "miss").sum()

    return {
        "total": total,
        "win": win,
        "lose": lose,
        "win_rate": rate(win, total),
        "my_serve_points": len(my_serve),
        "my_serve_win_rate": rate((my_serve["point_winner"] == "me").sum(), len(my_serve)),
        "op_serve_points": len(op_serve),
        "op_serve_win_rate": rate((op_serve["point_winner"] == "me").sum(), len(op_serve)),
        "by_len": by_len,
        "by_reason": by_reason,
        "third_attack_points": len(third_attack),
        "third_attack_point_rate": rate(third_attack_point, len(third_attack)),
        "third_attack_miss_rate": rate(third_attack_miss, len(third_attack)),
    }


def scoring_patterns(df: pd.DataFrame, *, limit: int = 6) -> list[dict]:
    """得点ラリーの結果タグを集計して主要パターンを返す。

    Parameters
    ----------
    df : pd.DataFrame
        集計対象の DataFrame。
    limit : int
        返す上位件数。

    Returns
    -------
    list[dict]
        区間またはレコードを表す辞書のリスト。
    """
    if df.empty:
        return []

    wins = df[df["point_winner"] == "me"].copy()
    if wins.empty:
        return []

    labels = wins["result_tag"].fillna("").astype(str).str.strip()
    wins["pattern_label"] = labels.where(labels != "", "未分類得点")

    grouped = (
        wins.groupby("pattern_label")
        .size()
        .reset_index(name="count")
        .sort_values(["count", "pattern_label"], ascending=[False, True])
        .reset_index(drop=True)
    )

    total = int(grouped["count"].sum())
    top = grouped.head(max(limit, 1)).copy()
    rest = grouped.iloc[len(top):]
    if not rest.empty:
        top = pd.concat(
            [
                top,
                pd.DataFrame(
                    [{"pattern_label": "その他", "count": int(rest["count"].sum())}]
                ),
            ],
            ignore_index=True,
        )

    top["ratio"] = top["count"].apply(lambda count: rate(count, total))
    return [
        {
            "label": str(row["pattern_label"]),
            "count": int(row["count"]),
            "ratio": float(row["ratio"]),
        }
        for _, row in top.iterrows()
    ]
