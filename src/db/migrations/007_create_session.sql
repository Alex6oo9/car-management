CREATE TABLE IF NOT EXISTS "session" (
    "sid" VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
    "sess" JSON NOT NULL,
    "expire" TIMESTAMPTZ(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);
