import json
from pathlib import Path

import pandas as pd
import streamlit as st

from backend.analytics import summarize
from backend.db import (
    create_match,
    delete_last_rally,
    fetch_downloaded_videos,
    fetch_matches,
    fetch_rallies,
    init_db,
    insert_rally,
    update_downloaded_video_segments,
    upsert_downloaded_video,
)
from backend.models import build_rally_input
from backend.video_analysis import (
    detect_set_boundaries_auto,
    download_video,
    export_video_segments,
    extract_match_segments,
    fetch_video_info,
    get_video_duration_sec,
)

init_db()
st.set_page_config(page_title="卓球 試合展開メモ & 集計 (MVP)", layout="wide")
st.title("卓球 試合展開メモ & 集計 (Streamlit MVP)")

if "extracted_match_segments" not in st.session_state:
    st.session_state["extracted_match_segments"] = []
if "confirmed_match_segments" not in st.session_state:
    st.session_state["confirmed_match_segments"] = []
if "t_start_input" not in st.session_state:
    st.session_state["t_start_input"] = 0.0
if "t_end_input" not in st.session_state:
    st.session_state["t_end_input"] = 0.0
if "video_seek_sec" not in st.session_state:
    st.session_state["video_seek_sec"] = 0.0
if "segment_mark_start_sec" not in st.session_state:
    st.session_state["segment_mark_start_sec"] = None
if "loaded_segments_video_path" not in st.session_state:
    st.session_state["loaded_segments_video_path"] = None
if "last_exported_clips" not in st.session_state:
    st.session_state["last_exported_clips"] = []
if "clip_seek_sec" not in st.session_state:
    st.session_state["clip_seek_sec"] = 0.0
if "clip_set_boundaries" not in st.session_state:
    st.session_state["clip_set_boundaries"] = {}


def _build_rally_clip_segments(
    rallies_df: pd.DataFrame,
    scope_start_sec: float | None = None,
    scope_end_sec: float | None = None,
) -> list[dict]:
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


def _build_set_segments_from_rallies(rally_segments: list[dict]) -> list[dict]:
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


def _build_set_segments_from_boundaries(clip_duration_sec: float, boundaries: list[float]) -> list[dict]:
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

with st.sidebar:
    st.header("試合を選択/作成")
    matches = fetch_matches()

    new_title = st.text_input("新しい試合タイトル", placeholder="例）2026-02-27 vs ○○（練習試合）")
    if st.button("試合を作成"):
        if new_title.strip():
            mid = create_match(new_title.strip())
            st.success(f"作成しました（match_id={mid}）")
        else:
            st.warning("タイトルを入力してください。")

    matches = fetch_matches()
    if matches.empty:
        st.info("左で試合を作成してください。")
        st.stop()

    match_label_to_id = {
        f'#{row["id"]} {row["title"]} ({row["created_at"]})': int(row["id"])
        for _, row in matches.iterrows()
    }
    selected_label = st.selectbox("試合", list(match_label_to_id.keys()))
    match_id = match_label_to_id[selected_label]

    st.divider()
    if st.button("直近のラリーを削除"):
        ok = delete_last_rally(match_id)
        if ok:
            st.success("直近ラリーを削除しました。")
        else:
            st.warning("削除できるラリーがありません。")

tabs = st.tabs(["入力", "集計", "データ", "YouTube解析"])

with tabs[0]:
    st.subheader("ラリー入力（1ラリー=1行）")
    st.markdown("### 動画表示")
    youtube_url = st.text_input(
        "YouTube URL（公開/限定公開）",
        placeholder="https://www.youtube.com/watch?v=...",
        key="youtube_url",
    )
    if youtube_url.strip():
        preview_col, _ = st.columns(2)
        with preview_col:
            st.video(youtube_url.strip())
    else:
        st.caption("URLを入れると動画を表示できます。")

    colA, colB, colC = st.columns([1, 1, 2])

    with colA:
        set_no = st.number_input("セット番号", min_value=1, max_value=7, value=1, step=1)
        server = st.radio("サーブ", ["me", "op"], horizontal=True, format_func=lambda x: "自分" if x == "me" else "相手")
        serve_type = st.selectbox("サーブ種（任意）", ["", "下短", "横下短", "横上", "ロング", "その他"])
        receive_type = st.selectbox(
            "レシーブ",
            ["short", "long", "flick", "push", "stop", "other"],
            format_func=lambda x: {
                "short": "短い",
                "long": "長い",
                "flick": "フリック",
                "push": "ツッツキ",
                "stop": "ストップ",
                "other": "その他",
            }[x],
        )

    with colB:
        rally_len_bucket = st.selectbox("ラリー長さ(ざっくり)", ["1-2", "3-4", "5-8", "9+"])
        point_winner = st.radio("得点", ["me", "op"], horizontal=True, format_func=lambda x: "自分" if x == "me" else "相手")
        end_reason = st.selectbox(
            "終わり方",
            ["my_miss", "op_miss", "winner", "ace", "receive_miss"],
            format_func=lambda x: {
                "my_miss": "自分ミス",
                "op_miss": "相手ミス",
                "winner": "ウィナーで決められ/決めた",
                "ace": "サービスエース",
                "receive_miss": "レシーブミス",
            }[x],
        )
        end_side = st.selectbox(
            "終点サイド",
            ["my_fh", "my_bh", "my_mid", "op_fh", "op_bh", "op_mid", "unknown"],
            format_func=lambda x: {
                "my_fh": "自分フォア",
                "my_bh": "自分バック",
                "my_mid": "自分ミドル",
                "op_fh": "相手フォア",
                "op_bh": "相手バック",
                "op_mid": "相手ミドル",
                "unknown": "不明",
            }[x],
        )

    with colC:
        st.caption("3球目（任意）：最初は「攻撃したか」だけでOK")
        my_3rd = st.radio(
            "自分3球目",
            ["none", "attack", "keep"],
            horizontal=True,
            format_func=lambda x: {"none": "なし/不明", "attack": "攻撃した", "keep": "つないだ"}[x],
        )
        my_3rd_result = st.radio(
            "3球目結果",
            ["na", "point", "continue", "miss"],
            horizontal=True,
            format_func=lambda x: {"na": "N/A", "point": "得点", "continue": "継続", "miss": "ミス"}[x],
        )
        st.caption("動画タイムスタンプ（秒、任意：後で自動化しやすくなる）")
        confirmed_segments = st.session_state.get("confirmed_match_segments", [])
        if confirmed_segments:
            segment_options = {
                f'{i+1}. {seg["start_sec"]:.2f}s - {seg["end_sec"]:.2f}s ({seg["duration_sec"]:.2f}s)': i
                for i, seg in enumerate(confirmed_segments)
            }
            selected_segment_label = st.selectbox("確定済み試合区間", list(segment_options.keys()))
            if st.button("選択区間をタイムスタンプに反映", width="stretch"):
                seg_idx = segment_options[selected_segment_label]
                seg = confirmed_segments[seg_idx]
                st.session_state["t_start_input"] = float(seg["start_sec"])
                st.session_state["t_end_input"] = float(seg["end_sec"])
                st.rerun()
        else:
            st.caption("YouTube解析タブで試合区間を抽出・確定すると、ここで反映できます。")
        t_start = st.number_input("t_start", min_value=0.0, step=0.1, format="%.1f", key="t_start_input")
        t_end = st.number_input("t_end", min_value=0.0, step=0.1, format="%.1f", key="t_end_input")
        note = st.text_input("メモ（任意）", placeholder="例）相手バック深いの嫌がる / ロングに弱い")

    c1, c2 = st.columns([1, 3])
    with c1:
        if st.button("このラリーを追加", type="primary", width="stretch"):
            payload = build_rally_input(
                set_no=set_no,
                server=server,
                serve_type=serve_type,
                receive_type=receive_type,
                rally_len_bucket=rally_len_bucket,
                point_winner=point_winner,
                end_reason=end_reason,
                end_side=end_side,
                my_3rd=my_3rd,
                my_3rd_result=my_3rd_result,
                t_start=t_start,
                t_end=t_end,
                note=note,
            ).to_record()
            insert_rally(match_id, payload)
            st.success("追加しました。")

    with c2:
        st.info("運用コツ：最初の5試合は項目を増やさず、このMVPのまま回してデータを溜めるのが一番伸びます。")

with tabs[1]:
    st.subheader("集計ダッシュボード")
    df = fetch_rallies(match_id)

    if df.empty:
        st.warning("まだラリーがありません。入力タブから追加してください。")
    else:
        s = summarize(df)

        c1, c2, c3, c4 = st.columns(4)
        c1.metric("総ポイント", s["total"])
        c2.metric("勝ち / 負け", f'{s["win"]} / {s["lose"]}')
        c3.metric("勝率", f'{s["win_rate"] * 100:.1f}%')
        c4.metric("相手サーブ時 得点率", f'{s["op_serve_win_rate"] * 100:.1f}%')

        st.divider()

        cA, cB = st.columns(2)
        with cA:
            st.markdown("### サーブ起点")
            st.write(
                pd.DataFrame(
                    [
                        {"局面": "自分サーブ時", "ポイント数": s["my_serve_points"], "得点率": f'{s["my_serve_win_rate"] * 100:.1f}%'},
                        {"局面": "相手サーブ時", "ポイント数": s["op_serve_points"], "得点率": f'{s["op_serve_win_rate"] * 100:.1f}%'},
                    ]
                )
            )

            st.markdown("### ラリー長さ別 勝率")
            show = s["by_len"][["rally_len_bucket", "points", "wins", "win_rate"]].copy()
            show["win_rate"] = show["win_rate"].map(lambda x: f"{x * 100:.1f}%")
            show = show.rename(columns={"rally_len_bucket": "ラリー長さ", "points": "ポイント数", "wins": "勝ち"})
            st.dataframe(show, width="stretch", hide_index=True)

        with cB:
            st.markdown("### 終わり方 内訳")
            show2 = s["by_reason"].copy()
            show2["ratio"] = show2["ratio"].map(lambda x: f"{x * 100:.1f}%")
            show2 = show2.rename(columns={"end_reason": "終わり方", "count": "回数", "ratio": "割合"})
            st.dataframe(show2, width="stretch", hide_index=True)

            st.markdown("### 3球目攻撃（入力してる場合）")
            st.dataframe(
                pd.DataFrame(
                    [
                        {"指標": "3球目攻撃回数", "値": f'{s["third_attack_points"]}'},
                        {"指標": "攻撃で得点率", "値": f'{s["third_attack_point_rate"] * 100:.1f}%'},
                        {"指標": "攻撃ミス率", "値": f'{s["third_attack_miss_rate"] * 100:.1f}%'},
                    ]
                ),
                width="stretch",
                hide_index=True,
            )

with tabs[2]:
    st.subheader("データ")
    df = fetch_rallies(match_id)
    st.dataframe(df, width="stretch", hide_index=True)

    colx, coly = st.columns(2)
    with colx:
        csv = df.to_csv(index=False).encode("utf-8-sig")
        st.download_button("CSVエクスポート", data=csv, file_name=f"match_{match_id}_rallies.csv", mime="text/csv")
    with coly:
        st.caption("dbファイル: tt_analyzer.db（ローカルに保存されます）")

with tabs[3]:
    st.subheader("YouTube解析")
    st.caption("公開または限定公開で、埋め込み/取得が可能な動画を対象にします。")

    if "show_yt_upload_inputs" not in st.session_state:
        st.session_state["show_yt_upload_inputs"] = False

    if st.button("アップロード", width="stretch", key="yt_show_upload_inputs"):
        st.session_state["show_yt_upload_inputs"] = True

    if st.session_state["show_yt_upload_inputs"]:
        yt_url = st.text_input(
            "解析対象のYouTube URL",
            placeholder="https://www.youtube.com/watch?v=...",
            key="yt_analysis_url",
        )
        out_dir = st.text_input("ダウンロード先", value="/app/data/videos", key="yt_out_dir")

        c1, c2 = st.columns(2)
        with c1:
            if st.button("動画情報を取得", width="stretch"):
                if not yt_url.strip():
                    st.warning("YouTube URLを入力してください。")
                else:
                    try:
                        info = fetch_video_info(yt_url.strip())
                        show = {
                            "id": info.get("id"),
                            "title": info.get("title"),
                            "uploader": info.get("uploader"),
                            "duration": info.get("duration"),
                            "view_count": info.get("view_count"),
                            "webpage_url": info.get("webpage_url"),
                        }
                        st.json(show)
                    except FileNotFoundError:
                        st.error("yt-dlp が見つかりません。環境にインストールしてください。")
                    except Exception as e:
                        st.error(f"動画情報の取得に失敗しました: {e}")

        with c2:
            if st.button("動画をダウンロード", type="primary", width="stretch"):
                if not yt_url.strip():
                    st.warning("YouTube URLを入力してください。")
                else:
                    try:
                        info = fetch_video_info(yt_url.strip())
                        video_path = download_video(yt_url.strip(), out_dir.strip())
                        upsert_downloaded_video(
                            source_url=yt_url.strip(),
                            local_path=video_path,
                            video_id=info.get("id"),
                            title=info.get("title"),
                            uploader=info.get("uploader"),
                            duration=info.get("duration"),
                        )
                        st.session_state["yt_video_path"] = video_path
                        st.success(f"保存完了: {video_path}")
                    except FileNotFoundError:
                        st.error("yt-dlp が見つかりません。環境にインストールしてください。")
                    except Exception as e:
                        st.error(f"ダウンロードに失敗しました: {e}")
    else:
        st.caption("「アップロード」を押すとURL入力欄が表示されます。")

    st.markdown("### 解析対象動画")
    videos_df = fetch_downloaded_videos()
    if videos_df.empty:
        st.caption("DBに保存された動画がありません。先にダウンロードしてください。")
        video_path = ""
    else:
        option_to_row = {}
        video_options = []
        for _, row in videos_df.iterrows():
            label = f'#{row["id"]} {row["title"] or "(no title)"} [{row["downloaded_at"]}]'
            video_options.append(label)
            option_to_row[label] = row.to_dict()

        default_idx = 0
        selected_video = st.selectbox("ダウンロード済み動画", video_options, index=default_idx, key="yt_video_selector")
        selected_video_row = option_to_row.get(selected_video, {})
        video_path = str(selected_video_row.get("local_path", ""))
        st.caption(f"選択中パス: {video_path}")

        loaded_path = st.session_state.get("loaded_segments_video_path")
        if video_path and loaded_path != video_path:
            saved_segments_json = selected_video_row.get("match_segments_json")
            loaded_segments = []
            if saved_segments_json:
                try:
                    loaded_segments = json.loads(saved_segments_json)
                except Exception:
                    loaded_segments = []
            st.session_state["extracted_match_segments"] = loaded_segments
            st.session_state["confirmed_match_segments"] = loaded_segments
            st.session_state["loaded_segments_video_path"] = video_path

        if video_path:
            st.markdown("#### 動画プレビュー")
            seek_sec = st.number_input("シーク位置(秒)", min_value=0.0, step=0.1, format="%.1f", key="video_seek_sec")
            st.caption("シーク位置を変えると、その時刻から再生表示します。")
            preview_col, _ = st.columns(2)
            with preview_col:
                st.video(video_path, start_time=int(float(seek_sec)))
            mark_col1, mark_col2 = st.columns(2)
            with mark_col1:
                if st.button("この時刻を区間マーク（1回目:開始 / 2回目:終了）", width="stretch"):
                    current_sec = round(float(st.session_state.get("video_seek_sec", 0.0)), 2)
                    pending_start = st.session_state.get("segment_mark_start_sec")
                    if pending_start is None:
                        st.session_state["segment_mark_start_sec"] = current_sec
                        st.success(f"開始時刻を記録: {current_sec:.2f}s")
                    else:
                        start_sec = min(float(pending_start), current_sec)
                        end_sec = max(float(pending_start), current_sec)
                        if end_sec <= start_sec:
                            st.warning("終了時刻は開始時刻より大きくしてください。")
                        else:
                            current_segments = st.session_state.get("extracted_match_segments", [])
                            current_segments.append(
                                {
                                    "start_sec": round(start_sec, 2),
                                    "end_sec": round(end_sec, 2),
                                    "duration_sec": round(end_sec - start_sec, 2),
                                }
                            )
                            st.session_state["extracted_match_segments"] = current_segments
                            st.session_state["segment_mark_start_sec"] = None
                            st.success(f"区間を追加: {start_sec:.2f}s - {end_sec:.2f}s")
            with mark_col2:
                if st.button("マークをリセット", width="stretch"):
                    st.session_state["segment_mark_start_sec"] = None
                    st.info("開始マークをリセットしました。")
            pending_start = st.session_state.get("segment_mark_start_sec")
            if pending_start is None:
                st.caption("マーク待機中: 1回目の押下で開始時刻を記録します。")
            else:
                st.caption(f"マーク待機中: 開始 {float(pending_start):.2f}s を記録済み。2回目の押下で終了時刻を確定します。")

    st.markdown("### 試合区間抽出（卓球台 + 動き量）")
    colm1, colm2, colm3 = st.columns(3)
    with colm1:
        match_sample_every_sec = st.number_input("サンプル間隔(秒)", min_value=0.1, value=0.5, step=0.1)
        table_ratio_threshold = st.number_input("卓球台しきい値", min_value=0.01, max_value=1.0, value=0.12, step=0.01)
    with colm2:
        motion_threshold = st.number_input("動き量しきい値", min_value=0.001, max_value=1.0, value=0.015, step=0.001, format="%.3f")
        min_segment_sec = st.number_input("最短区間(秒)", min_value=1.0, value=5.0, step=1.0)
    with colm3:
        bridge_gap_sec = st.number_input("区間結合ギャップ(秒)", min_value=0.0, value=2.0, step=0.5)

    if st.button("試合区間抽出を実行", width="stretch"):
        if not video_path.strip():
            st.warning("解析対象の動画を選択してください。")
        else:
            try:
                seg_result = extract_match_segments(
                    video_path=video_path.strip(),
                    sample_every_sec=float(match_sample_every_sec),
                    table_ratio_threshold=float(table_ratio_threshold),
                    motion_threshold=float(motion_threshold),
                    min_segment_sec=float(min_segment_sec),
                    bridge_gap_sec=float(bridge_gap_sec),
                )
                st.session_state["extracted_match_segments"] = seg_result["segments"]
                st.session_state["confirmed_match_segments"] = []
                st.json(
                    {
                        "path": seg_result["path"],
                        "duration_sec": seg_result["duration_sec"],
                        "num_segments": seg_result["num_segments"],
                        "thresholds": seg_result["thresholds"],
                    }
                )
                if not seg_result["segments"]:
                    st.info("該当区間が見つかりませんでした。しきい値を緩めて再実行してください。")
            except Exception as e:
                st.error(f"試合区間抽出に失敗しました: {e}")

    st.markdown("### 抽出結果の確認・手動入力")
    manual_col1, manual_col2, manual_col3 = st.columns([1, 1, 1])
    with manual_col1:
        manual_start_sec = st.number_input("手動開始秒", min_value=0.0, value=0.0, step=0.1, format="%.1f")
    with manual_col2:
        manual_end_sec = st.number_input("手動終了秒", min_value=0.0, value=5.0, step=0.1, format="%.1f")
    with manual_col3:
        st.caption(" ")
        if st.button("手動区間を追加", width="stretch"):
            if manual_end_sec <= manual_start_sec:
                st.warning("終了秒は開始秒より大きくしてください。")
            else:
                manual_segment = {
                    "start_sec": round(float(manual_start_sec), 2),
                    "end_sec": round(float(manual_end_sec), 2),
                    "duration_sec": round(float(manual_end_sec - manual_start_sec), 2),
                }
                current_segments = st.session_state.get("extracted_match_segments", [])
                current_segments.append(manual_segment)
                st.session_state["extracted_match_segments"] = current_segments
                st.success("手動区間を追加しました。")

    extracted_segments = st.session_state.get("extracted_match_segments", [])
    seg_df = pd.DataFrame(extracted_segments).copy()
    if seg_df.empty:
        seg_df = pd.DataFrame(
            {
                "start_sec": pd.Series(dtype="float64"),
                "end_sec": pd.Series(dtype="float64"),
                "duration_sec": pd.Series(dtype="float64"),
            }
        )
        st.caption("抽出結果がなくても、上の手動入力または表の行追加で区間を登録できます。")

    if "duration_sec" not in seg_df.columns:
        seg_df["duration_sec"] = seg_df["end_sec"] - seg_df["start_sec"]
    selected_map = st.session_state.get("match_segment_selected", {})
    use_values = [bool(selected_map.get(i, True)) for i in range(len(seg_df))]
    seg_df.insert(0, "use", pd.Series(use_values, dtype="bool"))
    edited_df = st.data_editor(
        seg_df,
        width="stretch",
        hide_index=True,
        num_rows="dynamic",
        column_config={
            "use": st.column_config.CheckboxColumn("採用"),
            "start_sec": st.column_config.NumberColumn("start_sec", format="%.2f"),
            "end_sec": st.column_config.NumberColumn("end_sec", format="%.2f"),
            "duration_sec": st.column_config.NumberColumn("duration_sec", format="%.2f"),
        },
        disabled=["duration_sec"],
        key="match_segments_editor",
    )
    edited_df = edited_df.copy()
    edited_df["use"] = edited_df["use"].fillna(False).astype(bool)
    edited_df["start_sec"] = pd.to_numeric(edited_df["start_sec"], errors="coerce").fillna(0.0)
    edited_df["end_sec"] = pd.to_numeric(edited_df["end_sec"], errors="coerce").fillna(0.0)
    edited_df["duration_sec"] = (edited_df["end_sec"] - edited_df["start_sec"]).clip(lower=0.0)
    st.session_state["match_segment_selected"] = {
        i: bool(v) for i, v in enumerate(edited_df["use"].tolist())
    }

    st.markdown("#### 試合開始/終了時刻（抽出・編集後）")
    for i, row in edited_df.iterrows():
        if bool(row["use"]):
            st.write(
                f'{i+1}. 開始 {float(row["start_sec"]):.2f}s / 終了 {float(row["end_sec"]):.2f}s'
            )

    if st.button("選択区間を確定", type="primary", width="stretch"):
        confirmed_df = edited_df[edited_df["use"]].copy()
        confirmed_df = confirmed_df[confirmed_df["end_sec"] > confirmed_df["start_sec"]]
        confirmed = confirmed_df[["start_sec", "end_sec", "duration_sec"]].round(2).to_dict(orient="records")
        st.session_state["confirmed_match_segments"] = confirmed
        if video_path.strip():
            update_downloaded_video_segments(video_path.strip(), confirmed)
        if confirmed:
            st.success(f"{len(confirmed)} 区間を確定しました。入力タブの t_start/t_end に反映できます。")
        else:
            st.warning("採用区間が0件です。開始/終了時刻とチェック状態を確認してください。")

    confirmed_segments = st.session_state.get("confirmed_match_segments", [])
    available_clips: list[str] = []
    if video_path.strip():
        source_path = Path(video_path.strip())
        clips_dir = source_path.parent / "clips" / source_path.stem
        if clips_dir.exists():
            available_clips = sorted(
                [str(p) for p in clips_dir.glob("*.mp4")],
                key=lambda p: Path(p).name,
            )

    if confirmed_segments:
        st.markdown("### 確定済み区間")
        st.dataframe(pd.DataFrame(confirmed_segments), width="stretch", hide_index=True)
        if st.button("確定済み区間で動画を切り抜く", width="stretch"):
            if not video_path.strip():
                st.warning("解析対象の動画を選択してください。")
            else:
                try:
                    export_result = export_video_segments(video_path.strip(), confirmed_segments)
                    st.session_state["last_exported_clips"] = export_result["clip_paths"]
                    available_clips = export_result["clip_paths"]
                    st.success(
                        f'{export_result["num_clips"]}件のクリップを書き出しました: {export_result["output_dir"]}'
                    )
                except FileNotFoundError:
                    st.error("ffmpeg が見つかりません。コンテナ内で実行してください。")
                except Exception as e:
                    st.error(f"動画切り抜きに失敗しました: {e}")

    exported_clips = available_clips or st.session_state.get("last_exported_clips", [])
    if exported_clips:
        st.markdown("### 切り抜き結果")
        st.write(pd.DataFrame({"clip_path": exported_clips}))
        preview_clip = st.selectbox("プレビューするクリップ", exported_clips, key="preview_clip_selector")
        clip_seek_sec = st.number_input(
            "クリップのシーク位置(秒)",
            min_value=0.0,
            step=0.1,
            format="%.1f",
            key="clip_seek_sec",
        )
        clip_col, _ = st.columns(2)
        with clip_col:
            st.video(preview_clip, start_time=int(float(clip_seek_sec)))

        boundaries_map = st.session_state.get("clip_set_boundaries", {})
        current_boundaries = list(boundaries_map.get(preview_clip, []))
        auto_col1, auto_col2, auto_col3, auto_col4 = st.columns(4)
        with auto_col1:
            auto_sample_every_sec = st.number_input(
                "自動検出サンプル(秒)",
                min_value=0.2,
                value=1.0,
                step=0.1,
                format="%.1f",
                key="auto_set_sample_every_sec",
            )
        with auto_col2:
            auto_min_break_sec = st.number_input(
                "最小休止(秒)",
                min_value=5.0,
                value=20.0,
                step=1.0,
                format="%.1f",
                key="auto_set_min_break_sec",
            )
        with auto_col3:
            auto_motion_threshold = st.number_input(
                "最小動きしきい値",
                min_value=0.001,
                value=0.008,
                step=0.001,
                format="%.3f",
                key="auto_set_motion_threshold",
            )
        with auto_col4:
            auto_edge_margin_sec = st.number_input(
                "端除外(秒)",
                min_value=0.0,
                value=10.0,
                step=1.0,
                format="%.1f",
                key="auto_set_edge_margin_sec",
            )

        action_col1, action_col2, action_col3, action_col4 = st.columns(4)
        with action_col1:
            if st.button("セット区切りを自動検出", width="stretch"):
                try:
                    result = detect_set_boundaries_auto(
                        preview_clip,
                        sample_every_sec=float(auto_sample_every_sec),
                        min_break_sec=float(auto_min_break_sec),
                        base_motion_threshold=float(auto_motion_threshold),
                        edge_margin_sec=float(auto_edge_margin_sec),
                    )
                    boundaries_map[preview_clip] = result["boundaries_sec"]
                    st.session_state["clip_set_boundaries"] = boundaries_map
                    current_boundaries = list(result["boundaries_sec"])
                    st.success(f'自動検出完了: {result["num_boundaries"]}件')
                except Exception as e:
                    st.error(f"自動検出に失敗しました: {e}")
        with action_col2:
            if st.button("この時刻でセット区切り", width="stretch"):
                mark_sec = round(float(st.session_state.get("clip_seek_sec", 0.0)), 2)
                if mark_sec not in current_boundaries:
                    current_boundaries.append(mark_sec)
                    current_boundaries.sort()
                    boundaries_map[preview_clip] = current_boundaries
                    st.session_state["clip_set_boundaries"] = boundaries_map
                    st.success(f"セット区切りを追加: {mark_sec:.2f}s")
                else:
                    st.info("同じ時刻の区切りは既に追加済みです。")
        with action_col3:
            if st.button("最後の区切りを削除", width="stretch"):
                if current_boundaries:
                    removed = current_boundaries.pop()
                    boundaries_map[preview_clip] = current_boundaries
                    st.session_state["clip_set_boundaries"] = boundaries_map
                    st.info(f"区切りを削除: {removed:.2f}s")
                else:
                    st.info("削除できる区切りがありません。")
        with action_col4:
            if st.button("区切りをリセット", width="stretch"):
                boundaries_map[preview_clip] = []
                st.session_state["clip_set_boundaries"] = boundaries_map
                st.info("このクリップの区切りをリセットしました。")

        st.markdown("#### セット区切り一覧")
        if current_boundaries:
            set_rows = [{"set_no": i + 1, "boundary_sec": sec} for i, sec in enumerate(current_boundaries)]
            st.dataframe(pd.DataFrame(set_rows), width="stretch", hide_index=True)
        else:
            st.caption("まだ区切りはありません。シークして「この時刻でセット区切り」を押してください。")

        st.markdown("#### セット / ラリー単位で切り抜き")
        scope_options = {"動画全体": None}
        for i, seg in enumerate(confirmed_segments):
            scope_options[f"確定区間 {i+1}: {seg['start_sec']:.2f}s - {seg['end_sec']:.2f}s"] = seg
        selected_scope_label = st.selectbox(
            "ラリー切り抜き対象の範囲",
            list(scope_options.keys()),
            key="rally_export_scope",
        )
        selected_scope = scope_options[selected_scope_label]
        scope_start_sec = float(selected_scope["start_sec"]) if selected_scope else None
        scope_end_sec = float(selected_scope["end_sec"]) if selected_scope else None

        rallies_df = fetch_rallies(match_id)
        rally_segments = _build_rally_clip_segments(rallies_df, scope_start_sec=scope_start_sec, scope_end_sec=scope_end_sec)
        set_segments_from_rally = _build_set_segments_from_rallies(rally_segments)

        clip_set_segments = []
        try:
            preview_duration = get_video_duration_sec(preview_clip)
            clip_set_segments = _build_set_segments_from_boundaries(preview_duration, current_boundaries)
        except FileNotFoundError:
            st.warning("ffprobe が見つかりません。セット区切りからの切り抜きは利用できません。")
        except Exception as e:
            st.warning(f"クリップ長の取得に失敗しました: {e}")

        source_stem = Path(video_path.strip()).stem if video_path.strip() else "source"
        source_clip_dir = Path(video_path.strip()).parent / "clips" / source_stem if video_path.strip() else Path("/tmp")
        rally_out_dir = source_clip_dir / f"match_{match_id:04d}" / "rallies"
        set_out_dir = source_clip_dir / f"match_{match_id:04d}" / "sets"
        clip_set_out_dir = Path(preview_clip).parent / "sets"

        st.caption(f"ラリー件数: {len(rally_segments)} / セット件数(ラリー集約): {len(set_segments_from_rally)}")
        rally_action_col1, rally_action_col2, rally_action_col3 = st.columns(3)
        with rally_action_col1:
            if st.button("選択クリップをセット単位で切り抜く", width="stretch", key="clip_set_export"):
                if not clip_set_segments:
                    st.warning("セット区切りがありません。先に区切りを設定してください。")
                else:
                    try:
                        export_result = export_video_segments(preview_clip, clip_set_segments, out_dir=str(clip_set_out_dir))
                        st.session_state["last_exported_clips"] = export_result["clip_paths"]
                        st.success(f'セット単位で {export_result["num_clips"]}件 書き出しました: {export_result["output_dir"]}')
                    except Exception as e:
                        st.error(f"セット単位の切り抜きに失敗しました: {e}")
        with rally_action_col2:
            if st.button("試合をセット単位で切り抜く", width="stretch", key="db_set_export"):
                if not video_path.strip():
                    st.warning("解析対象の動画を選択してください。")
                elif not set_segments_from_rally:
                    st.warning("セット切り抜き用の時刻データが不足しています（ラリーの t_start/t_end を入力してください）。")
                else:
                    try:
                        export_result = export_video_segments(video_path.strip(), set_segments_from_rally, out_dir=str(set_out_dir))
                        st.session_state["last_exported_clips"] = export_result["clip_paths"]
                        st.success(f'セット単位で {export_result["num_clips"]}件 書き出しました: {export_result["output_dir"]}')
                    except Exception as e:
                        st.error(f"セット単位の切り抜きに失敗しました: {e}")
        with rally_action_col3:
            if st.button("試合を全ラリー単位で切り抜く", width="stretch", key="db_rally_export_all"):
                if not video_path.strip():
                    st.warning("解析対象の動画を選択してください。")
                elif not rally_segments:
                    st.warning("ラリー切り抜き用の時刻データが不足しています（ラリーの t_start/t_end を入力してください）。")
                else:
                    try:
                        export_result = export_video_segments(video_path.strip(), rally_segments, out_dir=str(rally_out_dir))
                        st.session_state["last_exported_clips"] = export_result["clip_paths"]
                        st.success(f'ラリー単位で {export_result["num_clips"]}件 書き出しました: {export_result["output_dir"]}')
                    except Exception as e:
                        st.error(f"ラリー単位の切り抜きに失敗しました: {e}")

        if rally_segments:
            rally_choices = {
                f'Rally#{seg["rally_id"]} Set{seg["set_no"]} {seg["start_sec"]:.2f}s-{seg["end_sec"]:.2f}s': seg
                for seg in rally_segments
            }
            selected_rally_label = st.selectbox(
                "1ラリー切り抜き対象",
                list(rally_choices.keys()),
                key="single_rally_selector",
            )
            if st.button("選択した1ラリーだけ切り抜く", width="stretch", key="db_rally_export_single"):
                if not video_path.strip():
                    st.warning("解析対象の動画を選択してください。")
                else:
                    try:
                        selected_rally = rally_choices[selected_rally_label]
                        export_result = export_video_segments(video_path.strip(), [selected_rally], out_dir=str(rally_out_dir))
                        st.session_state["last_exported_clips"] = export_result["clip_paths"]
                        st.success(f'1ラリー書き出し完了: {export_result["clip_paths"][0]}')
                    except Exception as e:
                        st.error(f"1ラリー切り抜きに失敗しました: {e}")
