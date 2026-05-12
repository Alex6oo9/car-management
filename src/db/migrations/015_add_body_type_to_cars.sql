DO $$ BEGIN
  CREATE TYPE car_body_type AS ENUM (
    'sedan',
    'hatchback',
    'suv',
    'pickup_truck',
    'van_minivan',
    'electric',
    'coupe',
    'convertible'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE cars ADD COLUMN IF NOT EXISTS body_type car_body_type;

CREATE INDEX IF NOT EXISTS idx_cars_body_type ON cars(body_type);
