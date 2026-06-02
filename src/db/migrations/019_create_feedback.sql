CREATE TABLE IF NOT EXISTS feedback (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  stars       INTEGER     NOT NULL CHECK (stars >= 1 AND stars <= 5),
  name        TEXT        NOT NULL DEFAULT 'Anonymous',
  message     TEXT        NOT NULL,
  is_approved BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_is_approved ON feedback(is_approved);
