import { pool } from './pool.js';

export async function cleanupExpiredTokens(): Promise<void> {
  await pool.query('DELETE FROM email_verification_tokens WHERE expires_at < NOW()');
  await pool.query('DELETE FROM password_reset_tokens WHERE expires_at < NOW()');
}