CREATE TABLE IF NOT EXISTS dealer_contacts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  showroom_name   TEXT        NOT NULL DEFAULT 'BKK Kaung Pyae',
  open_day_from   TEXT,
  open_day_to     TEXT,
  open_time_from  TEXT,
  open_time_to    TEXT,
  status          TEXT        NOT NULL DEFAULT 'auto'
                  CHECK (status IN ('auto', 'open', 'closed')),
  phone_number    TEXT,
  line_contact    TEXT,
  facebook_url    TEXT,
  instagram_url   TEXT,
  gmail           TEXT,
  viber_contact   TEXT,
  wechat_contact  TEXT,
  map_url         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO dealer_contacts (showroom_name)
SELECT 'BKK Kaung Pyae'
WHERE NOT EXISTS (SELECT 1 FROM dealer_contacts);
