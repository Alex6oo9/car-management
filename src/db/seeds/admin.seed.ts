import bcrypt from 'bcrypt';
import { pool } from '../pool.js';

async function seedAdmin() {
  const email = 'admin@example.com';
  const password = 'admin123';
  const fullName = 'System Admin';
  const role = 'admin';

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE users SET is_email_verified = TRUE WHERE email = $1 AND is_email_verified = FALSE`,
      [email]
    );
    console.log('Admin user already exists. Ensured is_email_verified = true.');
    await pool.end();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await pool.query(
    `INSERT INTO users (email, password_hash, full_name, role, is_email_verified)
     VALUES ($1, $2, $3, $4, TRUE)`,
    [email, passwordHash, fullName, role]
  );

  console.log('Admin user created successfully.');
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${password}`);
  await pool.end();
}

seedAdmin().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
