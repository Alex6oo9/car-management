import { pool } from '../pool.js';
import type { User } from '../../types/models.js';

export const usersRepo = {
  async findByEmail(email: string): Promise<User | null> {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
  },

  async findById(id: string): Promise<User | null> {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  async findAll(filters: { role?: string; is_active?: boolean } = {}): Promise<{ users: Omit<User, 'password_hash'>[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filters.role) {
      conditions.push(`role = $${paramIdx++}`);
      params.push(filters.role);
    }
    if (filters.is_active !== undefined) {
      conditions.push(`is_active = $${paramIdx++}`);
      params.push(filters.is_active);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(`SELECT COUNT(*) FROM users ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await pool.query(
      `SELECT id, email, full_name, role, is_active, created_at, updated_at
       FROM users ${where} ORDER BY created_at DESC`,
      params
    );

    return { users: result.rows, total };
  },

  async create(data: { email: string; password_hash: string; full_name: string; role: string }): Promise<Omit<User, 'password_hash'>> {
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, role, is_active, created_at, updated_at`,
      [data.email, data.password_hash, data.full_name, data.role]
    );
    return result.rows[0];
  },

  async update(id: string, data: { full_name?: string; is_active?: boolean }): Promise<Omit<User, 'password_hash'> | null> {
    const fields: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (data.full_name !== undefined) {
      fields.push(`full_name = $${paramIdx++}`);
      params.push(data.full_name);
    }
    if (data.is_active !== undefined) {
      fields.push(`is_active = $${paramIdx++}`);
      params.push(data.is_active);
    }

    if (fields.length === 0) return this.findById(id) as any;

    fields.push(`updated_at = now()`);
    params.push(id);

    const result = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIdx}
       RETURNING id, email, full_name, role, is_active, created_at, updated_at`,
      params
    );
    return result.rows[0] || null;
  },

  async updateRole(id: string, role: 'employee'): Promise<Omit<User, 'password_hash'> | null> {
    const result = await pool.query(
      `UPDATE users
       SET role = $1, updated_at = now()
       WHERE id = $2
       RETURNING id, email, full_name, role, is_active, created_at, updated_at`,
      [role, id]
    );
    return result.rows[0] || null;
  },
  async findByGoogleId(googleId: string): Promise<User | null> {
    const result = await pool.query(
      'SELECT * FROM users WHERE google_id = $1',
      [googleId]
    );
    return result.rows[0] || null;
  },
  async linkGoogleAccount(userId: string, googleId: string): Promise<User | null> {
    const result = await pool.query(
      `UPDATE users
       SET google_id = $1,
           auth_provider = 'google',
           is_email_verified = TRUE,
           updated_at = now()
       WHERE id = $2
       RETURNING *`,
      [googleId, userId]
    );
    return result.rows[0] || null;
  },
  async createGoogleUser(data: {
    email: string;
    full_name: string;
    google_id: string;
  }): Promise<User> {
    const result = await pool.query(
      `INSERT INTO users (
         email, password_hash, full_name, role, is_active, is_email_verified, auth_provider, google_id
       )
       VALUES ($1, NULL, $2, 'client', TRUE, TRUE, 'google', $3)
       RETURNING *`,
      [data.email, data.full_name, data.google_id]
    );
    return result.rows[0] as User;
  },

  async delete(id: string): Promise<boolean> {
    const result = await pool.query(
      `UPDATE users SET is_active = false, updated_at = now() WHERE id = $1`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  },

  async hardDelete(id: string): Promise<boolean> {
    // Remove active sessions first
    await pool.query(
      `DELETE FROM "session"
       WHERE sess->'passport'->>'user' = $1`,
      [id]
    );

    const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  },
  
};
