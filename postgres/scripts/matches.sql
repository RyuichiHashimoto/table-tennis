DROP TABLE IF EXISTS matches;

CREATE TABLE matches (
    id BIGSERIAL PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    initial_server TEXT NOT NULL DEFAULT 'me',
    my_player_name TEXT NOT NULL DEFAULT '自分',
    opponent_player_name TEXT NOT NULL DEFAULT '相手',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);

INSERT INTO matches (
    id,
    uuid,
    title,
    initial_server,
    my_player_name,
    opponent_player_name,
    created_at,
    updated_at,
    is_deleted,
    deleted_at
)
VALUES
(
    1,
    'c45e6400-a86b-406c-8d82-b8664749e00b',
    '2026-03-04 vs practice',
    'me',
    '自分',
    '相手',
    '2026-05-02 00:52:50+09',
    '2026-05-02 00:52:50+09',
    FALSE,
    NULL
),
(
    2,
    '0d83d434-aaaa-4632-8a61-4c5fde8408de',
    '新規試合 2026-05-02',
    'me',
    '自分',
    '相手',
    '2026-05-02 12:52:55+09',
    '2026-05-02 12:52:55+09',
    FALSE,
    NULL
),
(
    3,
    '4ce23068-e47d-44b9-a91a-a258c1345ca9',
    '新規試合 2026-05-03',
    'me',
    '自分',
    '相手',
    '2026-05-03 13:37:56+09',
    '2026-05-03 13:37:56+09',
    FALSE,
    NULL
),
(
    4,
    '5d835b38-7655-4fec-a863-761366027463',
    '新規試合 2026-05-03',
    'me',
    '自分',
    '相手',
    '2026-05-03 17:51:14+09',
    '2026-05-03 17:51:14+09',
    FALSE,
    NULL
),
(
    5,
    '0a892dcb-fd15-4deb-8e66-aa9a640ce8a4',
    'A+B',
    'me',
    '自分',
    '相手',
    '2026-05-03 18:26:15+09',
    '2026-05-03 18:26:15+09',
    FALSE,
    NULL
);

SELECT setval('matches_id_seq', (SELECT MAX(id) FROM matches));