import bcrypt from 'bcrypt';
import { pool } from '../pool.js';

async function seedAdmin() {
  const email = 'admin@example.com';
  const password = 'admin123';
  const fullName = 'System Admin';
  const role = 'admin';

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    console.log('Admin user already exists, skipping seed.');
    await pool.end();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await pool.query(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4)`,
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
