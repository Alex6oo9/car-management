import { pool } from '../pool.js';

async function clearTestData() {
  // Order matters: delete child tables before parents to satisfy FK constraints
  await pool.query('DELETE FROM purchases');
  await pool.query('DELETE FROM rentals');
  await pool.query('DELETE FROM rental_terms');
  // car_images and car_documents are CASCADE-deleted with cars
  await pool.query('DELETE FROM cars');
  await pool.query('DELETE FROM customers');
  // Delete all non-admin users (employees + clients created during testing)
  // email_verification_tokens and password_reset_tokens CASCADE-delete with users
  await pool.query("DELETE FROM users WHERE role != 'admin'");

  console.log('Test data cleared.');
  console.log('  Deleted: purchases, rentals, rental_terms, cars, customers, employees, clients');
  console.log('  Kept: admin user, sessions, migrations');
  await pool.end();
}

clearTestData().catch((err) => {
  console.error('Clear failed:', err);
  process.exit(1);
});
