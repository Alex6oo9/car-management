CREATE TABLE rental_terms (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title              TEXT        NOT NULL,
  description        TEXT        NOT NULL,
  is_active          BOOLEAN     NOT NULL DEFAULT true,
  sort_order         INTEGER     NOT NULL DEFAULT 0,
  created_by_user_id UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rental_terms_is_active ON rental_terms(is_active);
