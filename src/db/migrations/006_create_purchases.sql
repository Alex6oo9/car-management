DO $$ BEGIN
    CREATE TYPE purchase_status AS ENUM ('pending', 'paid', 'cancelled', 'refunded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    car_id UUID NOT NULL REFERENCES cars(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    sale_price NUMERIC(12, 2) NOT NULL,
    currency_code CHAR(3) DEFAULT 'THB',
    status purchase_status DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_purchases_car_id ON purchases(car_id);
CREATE INDEX IF NOT EXISTS idx_purchases_customer_id ON purchases(customer_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_paid_car ON purchases(car_id) WHERE status = 'paid';
