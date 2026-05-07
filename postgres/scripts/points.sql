DROP TABLE IF EXISTS points;

CREATE TABLE points (
    id BIGSERIAL PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    match_id BIGINT NOT NULL REFERENCES matches(id),
    set_no INTEGER NOT NULL,
    server TEXT NOT NULL,
    point_winner TEXT NOT NULL,
    sort_order DOUBLE PRECISION NOT NULL,
    starred BOOLEAN NOT NULL DEFAULT FALSE,
    result_tag TEXT,
    t_start DOUBLE PRECISION,
    t_end DOUBLE PRECISION,
    serve_type TEXT,
    receive_type TEXT NOT NULL,
    my_3rd TEXT,
    my_3rd_result TEXT,
    rally_len_bucket TEXT NOT NULL,
    end_reason TEXT NOT NULL,
    end_side TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_points_match_id_sort_order ON points (match_id, sort_order, id);
