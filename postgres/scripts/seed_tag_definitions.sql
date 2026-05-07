-- デフォルトのタグ定義を初期データとして投入する
-- 対象DB: data/matches/index.sqlite
-- 実行方法: sqlite3 data/matches/index.sqlite < script/seed_tag_definitions.sql
--
-- 既存のタグ定義を全削除してから再投入する（冪等性なし）

DROP TABLE IF EXISTS tag_definitions;

CREATE TABLE IF NOT EXISTS tag_definitions (
    id BIGSERIAL PRIMARY KEY,
    tag TEXT NOT NULL UNIQUE,
    player_side TEXT NOT NULL CHECK (player_side IN ('me', 'op', 'both')),
    phase TEXT NOT NULL CHECK (phase IN ('serve', 'receive', 'rally')),
    shot_type TEXT NOT NULL CHECK (shot_type IN ('miss', 'point', 'any')),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

TRUNCATE TABLE tag_definitions RESTART IDENTITY;

INSERT INTO tag_definitions 
    (tag, player_side, phase, shot_type)
VALUES
('サーブミス',       'me',   'serve',   'miss'),
('サーブ得点',       'me',   'serve',   'point'),
('レシーブミス',     'me',   'receive', 'miss'),
('レシーブ得点',     'me',   'receive', 'point'),
('3球目ミス',        'me',   'rally',   'miss'),
('3球目得点',        'me',   'rally',   'point'),
('4球目ミス',        'me',   'rally',   'miss'),
('4球目得点',        'me',   'rally',   'point'),
('ラリーミス',       'me',   'rally',   'miss'),
('ラリー得点',       'me',   'rally',   'point'),
('相手サーブミス',   'op',   'serve',   'miss'),
('相手レシーブミス', 'op',   'receive', 'miss'),
('相手3球目ミス',    'op',   'rally',   'miss'),
('相手ラリーミス',   'op',   'rally',   'miss'),
('ネットイン',       'both', 'rally',   'any'),
('エッジボール',     'both', 'rally',   'any');