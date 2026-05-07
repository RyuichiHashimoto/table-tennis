DROP TABLE IF EXISTS input_state;

CREATE TABLE input_state (
    match_id BIGINT PRIMARY KEY REFERENCES matches(id),
    state_json TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
