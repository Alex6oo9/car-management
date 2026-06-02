DO $$ BEGIN
  CREATE TYPE car_listing_type AS ENUM ('sale', 'rent');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- nullable add first so existing rows don't fail, then backfill + default
ALTER TABLE cars ADD COLUMN IF NOT EXISTS listing_type car_listing_type;
UPDATE cars SET listing_type = 'sale' WHERE listing_type IS NULL;
ALTER TABLE cars ALTER COLUMN listing_type SET DEFAULT 'sale';
ALTER TABLE cars ALTER COLUMN listing_type SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cars_listing_type ON cars(listing_type);
