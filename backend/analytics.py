import pandas as pd


def rate(numer, denom) -> float:
    return float(numer) / float(denom) if denom else 0.0


def summarize(df: pd.DataFrame) -> dict:
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
