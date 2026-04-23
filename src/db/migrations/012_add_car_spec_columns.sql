ALTER TABLE cars
  ADD COLUMN fuel         TEXT CHECK (fuel IN ('petrol', 'diesel', 'electric', 'hybrid', 'plug-in hybrid')),
  ADD COLUMN transmission TEXT CHECK (transmission IN ('automatic', 'manual', 'cvt')),
  ADD COLUMN color        TEXT,
  ADD COLUMN engine       TEXT,
  ADD COLUMN drive        TEXT CHECK (drive IN ('fwd', 'rwd', 'awd', '4wd')),
  ADD COLUMN seats        INTEGER CHECK (seats > 0 AND seats <= 20);
