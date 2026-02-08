DO $$ BEGIN
    CREATE TYPE car_status AS ENUM ('available', 'reserved', 'rented', 'sold', 'maintenance');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS cars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vin TEXT UNIQUE,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL CHECK (year >= 1900 AND year <= EXTRACT(YEAR FROM now()) + 1),
    mileage_km INTEGER DEFAULT 0 CHECK (mileage_km >= 0),
    sale_price NUMERIC(12, 2) CHECK (sale_price >= 0),
    rent_price_per_day NUMERIC(12, 2) CHECK (rent_price_per_day >= 0),
    currency_code CHAR(3) DEFAULT 'THB',
    status car_status DEFAULT 'available',
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_cars_status ON cars(status);
CREATE INDEX IF NOT EXISTS idx_cars_brand_model ON cars(brand, model);
CREATE INDEX IF NOT EXISTS idx_cars_is_published ON cars(is_published);
