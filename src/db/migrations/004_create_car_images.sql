CREATE TABLE IF NOT EXISTS car_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    car_id UUID NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (car_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_car_images_car_id ON car_images(car_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_car_primary_image ON car_images(car_id) WHERE is_primary = true;
