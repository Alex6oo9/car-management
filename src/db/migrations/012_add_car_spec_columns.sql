ALTER TABLE cars ADD COLUMN IF NOT EXISTS fuel         TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS transmission TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS color        TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS engine       TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS drive        TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS seats        INTEGER;

DO $$ BEGIN
  ALTER TABLE cars ADD CONSTRAINT cars_fuel_check
    CHECK (fuel IN ('petrol', 'diesel', 'electric', 'hybrid', 'plug-in hybrid'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE cars ADD CONSTRAINT cars_transmission_check
    CHECK (transmission IN ('automatic', 'manual', 'cvt'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE cars ADD CONSTRAINT cars_drive_check
    CHECK (drive IN ('fwd', 'rwd', 'awd', '4wd'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE cars ADD CONSTRAINT cars_seats_check
    CHECK (seats > 0 AND seats <= 20);
EXCEPTION WHEN duplicate_object THEN null;
END $$;
