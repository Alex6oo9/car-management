-- Google OAuth support for users table

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'local';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_id TEXT;

-- make local password optional for google accounts
ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL;

-- keep values safe
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_auth_provider_check;

ALTER TABLE users
  ADD CONSTRAINT users_auth_provider_check
  CHECK (auth_provider IN ('local', 'google'));

-- unique google id only when present
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id_unique
  ON users(google_id)
  WHERE google_id IS NOT NULL;