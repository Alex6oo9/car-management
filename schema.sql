-- =============================================================
--  Car Showroom Management System — Full Schema
--  Compatible with dbdiagram.io, drawSQL, QuickDBD, DBeaver, etc.
-- =============================================================

CREATE TABLE users (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email             TEXT        UNIQUE NOT NULL,
    password_hash     TEXT,
    full_name         TEXT        NOT NULL,
    role              TEXT        NOT NULL DEFAULT 'client',
    is_active         BOOLEAN     NOT NULL DEFAULT true,
    is_email_verified BOOLEAN     NOT NULL DEFAULT false,
    auth_provider     TEXT        NOT NULL DEFAULT 'local',
    google_id         TEXT        UNIQUE,
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE customers (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name    TEXT        NOT NULL,
    phone        TEXT,
    email        TEXT,
    address_line TEXT,
    city         TEXT,
    country      TEXT,
    created_at   TIMESTAMPTZ DEFAULT now(),
    updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE cars (
    id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    vin                TEXT          UNIQUE,
    brand              TEXT          NOT NULL,
    model              TEXT          NOT NULL,
    year               INTEGER       NOT NULL,
    mileage_km         INTEGER       DEFAULT 0,
    sale_price         NUMERIC(12,2),
    rent_price_per_day NUMERIC(12,2),
    currency_code      CHAR(3)       DEFAULT 'THB',
    status             TEXT          NOT NULL DEFAULT 'available',
    is_published       BOOLEAN       DEFAULT false,
    created_at         TIMESTAMPTZ   DEFAULT now(),
    updated_at         TIMESTAMPTZ   DEFAULT now(),
    created_by_user_id UUID          REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE car_images (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    car_id       UUID        NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
    storage_path TEXT        NOT NULL,
    is_primary   BOOLEAN     DEFAULT false,
    sort_order   INTEGER     DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE rentals (
    id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    car_id             UUID          NOT NULL REFERENCES cars(id) ON DELETE RESTRICT,
    customer_id        UUID          NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    start_date         DATE          NOT NULL,
    end_date           DATE          NOT NULL,
    price_per_day      NUMERIC(12,2) NOT NULL,
    total_price        NUMERIC(12,2) NOT NULL,
    deposit_amount     NUMERIC(12,2) DEFAULT 0,
    currency_code      CHAR(3)       DEFAULT 'THB',
    status             TEXT          NOT NULL DEFAULT 'pending',
    cancelled_reason   TEXT,
    created_at         TIMESTAMPTZ   DEFAULT now(),
    updated_at         TIMESTAMPTZ   DEFAULT now(),
    created_by_user_id UUID          REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE purchases (
    id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    car_id             UUID          NOT NULL REFERENCES cars(id) ON DELETE RESTRICT,
    customer_id        UUID          NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    sale_price         NUMERIC(12,2) NOT NULL,
    currency_code      CHAR(3)       DEFAULT 'THB',
    status             TEXT          NOT NULL DEFAULT 'pending',
    created_at         TIMESTAMPTZ   DEFAULT now(),
    updated_at         TIMESTAMPTZ   DEFAULT now(),
    created_by_user_id UUID          REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE session (
    sid    VARCHAR     PRIMARY KEY,
    sess   JSON        NOT NULL,
    expire TIMESTAMPTZ NOT NULL
);

CREATE TABLE email_verification_tokens (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT        NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE password_reset_tokens (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT        NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used       BOOLEAN     NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);
