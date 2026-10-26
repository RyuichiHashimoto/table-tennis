-- 2026-10-21 時点で公開情報から確認した大阪府内の卓球大会サンプル。
-- (provider_url, external_id) の組み合わせで何度実行しても重複しない。

INSERT INTO scheduled_matches
    (provider_url, external_id, title, starts_at, venue, competition, source_url, fetched_at)
VALUES
    (
        'https://i2unet.com/event/osaka?hl=ja',
        '128916ab7ea72aa8ef',
        '第22回 I2Uなんばカップ',
        '2026-10-25 13:30:00+09',
        'HPC西ナンバ卓球センター（大阪市浪速区）',
        'i2U・混合シングルス',
        'https://i2unet.com/event/detail/128916ab7ea72aa8ef',
        NOW()
    ),
    (
        'https://www.city.minoh.lg.jp/sports/news/documents/r8aki_04takkyu_youkou.pdf',
        'minoh-2026-autumn-general',
        '第70回秋季市民体育大会（卓球の部）一般の部',
        '2026-10-25 09:00:00+09',
        '第一総合運動場 市民体育館（スカイアリーナ・箕面市）',
        '市民大会・団体戦',
        'https://www.city.minoh.lg.jp/sports/news/documents/r8aki_04takkyu_youkou.pdf',
        NOW()
    ),
    (
        'https://three-star-llc.com/collections/osaka',
        'osaka-its20261027',
        '第24回 Nittaku杯 ITS平日レディースランク別シングルスリーグ戦',
        '2026-10-27 09:00:00+09',
        '守口市民体育館1F 多目的室（守口市）',
        'オープン・女子シングルス',
        'https://three-star-llc.com/products/osaka-its20261027',
        NOW()
    ),
    (
        'https://i2unet.com/event/osaka?hl=ja',
        '973556aafc9c207a6a',
        'andro杯 緑橋i2Uレーティング sponsor by 三英',
        '2026-11-15 09:30:00+09',
        '緑橋卓球場（大阪市東成区）',
        'i2U・混合シングルス',
        'https://i2unet.com/event/detail/973556aafc9c207a6a',
        NOW()
    ),
    (
        'https://three-star-llc.com/collections/osaka',
        'osaka-its-261115',
        '第6回ITS杯ヴィエントカップ 男・女ランク別シングルス大会',
        '2026-11-15 09:00:00+09',
        'ヴィエントとよのスポーツセンター（豊能町）',
        'オープン・男女別シングルス',
        'https://three-star-llc.com/products/osaka-its-261115',
        NOW()
    ),
    (
        'https://sakai.h-osaka.jp/101.php',
        'sakai-championship-2026',
        '堺卓球選手権大会',
        '2026-11-23 10:00:00+09',
        '大浜だいしんアリーナ（堺市立大浜体育館）',
        '市協会大会・シングルス／ダブルス',
        'https://sakai.h-osaka.jp/101.php',
        NOW()
    ),
    (
        'https://three-star-llc.com/collections/osaka',
        'osaka-its20261124',
        '第25回 Nittaku杯 ITS平日レディースランク別シングルスリーグ戦',
        '2026-11-24 09:00:00+09',
        '守口市民体育館1F 多目的室（守口市）',
        'オープン・女子シングルス',
        'https://three-star-llc.com/products/osaka-its20261124',
        NOW()
    ),
    (
        'https://three-star-llc.com/collections/osaka',
        'osaka-its20261212',
        'andro杯 ITSナイトリーグ ランク別シングルス戦',
        '2026-12-12 17:00:00+09',
        '守口市民体育館1F 小体育室（守口市）',
        'オープン・シングルス',
        'https://three-star-llc.com/products/osaka-its20261212',
        NOW()
    ),
    (
        'https://i2unet.com/event/osaka?hl=ja',
        '138336ad498026667a',
        'andro杯 緑橋i2Uレーティング',
        '2026-12-20 09:30:00+09',
        '緑橋卓球場（大阪市東成区）',
        'i2U・混合シングルス',
        'https://i2unet.com/event/detail/138336ad498026667a',
        NOW()
    ),
    (
        'https://three-star-llc.com/collections/osaka',
        'osaka-its20261229',
        '第26回 Nittaku杯 ITS平日レディースランク別シングルスリーグ戦',
        '2026-12-29 09:00:00+09',
        '守口市民体育館1F 多目的室（守口市）',
        'オープン・女子シングルス',
        'https://three-star-llc.com/products/osaka-its20261229',
        NOW()
    )
ON CONFLICT (provider_url, external_id) DO UPDATE SET
    title = EXCLUDED.title,
    starts_at = EXCLUDED.starts_at,
    venue = EXCLUDED.venue,
    competition = EXCLUDED.competition,
    source_url = EXCLUDED.source_url,
    fetched_at = NOW();
