CREATE TABLE IF NOT EXISTS car_documents (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id             UUID        NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  field_name         TEXT        NOT NULL,
  field_value        TEXT        NOT NULL,
  sort_order         INTEGER     NOT NULL DEFAULT 0,
  created_by_user_id UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_car_documents_car_id ON car_documents(car_id);
