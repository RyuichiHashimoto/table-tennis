from pytube import YouTube

def download_youtube_mp4(url: str, output_path: str = ".") -> None:
    """
    YouTubeの動画をMP4形式でダウンロードする。

    Parameters:
        url (str): ダウンロードしたいYouTube動画のURL。
        output_path (str): 動画の保存先フォルダのパス（デフォルトは現在のフォルダ）。

    Returns:
        None

    Example:
        download_youtube_mp4("https://www.youtube.com/watch?v=xxxxxx", "./videos")
    """
    yt = YouTube(url)

    # 動画の中で最も画質の良いmp4フォーマットを選択
    stream = yt.streams.filter(file_extension='mp4', progressive=True).order_by('resolution').desc().first()

    if stream is None:
        raise ValueError("利用可能なMP4形式の動画が見つかりませんでした。")

    # ダウンロードの実行
    print(f"Downloading: {yt.title}")
    stream.download(output_path=output_path)
    print("Download completed!")

# 使用例:
# download_youtube_mp4("https://www.youtube.com/watch?v=xxxxxx", "./videos")
