DO $$ BEGIN
    CREATE TYPE rental_status AS ENUM ('pending', 'confirmed', 'active', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS rentals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    car_id UUID NOT NULL REFERENCES cars(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    price_per_day NUMERIC(12, 2) NOT NULL,
    total_price NUMERIC(12, 2) NOT NULL,
    deposit_amount NUMERIC(12, 2) DEFAULT 0,
    currency_code CHAR(3) DEFAULT 'THB',
    status rental_status DEFAULT 'pending',
    cancelled_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT check_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_rentals_car_id ON rentals(car_id);
CREATE INDEX IF NOT EXISTS idx_rentals_customer_id ON rentals(customer_id);
CREATE INDEX IF NOT EXISTS idx_rentals_dates ON rentals(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_rentals_status ON rentals(status);
