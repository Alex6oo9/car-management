import { pool } from '../pool.js';
import type { Customer } from '../../types/models.js';

export const customersRepo = {
  async findById(id: string): Promise<Customer | null> {
    const result = await pool.query('SELECT * FROM customers WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  async findAll(filters: { search?: string; limit?: number; offset?: number } = {}): Promise<{ customers: Customer[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filters.search) {
      conditions.push(`(full_name ILIKE $${paramIdx} OR phone ILIKE $${paramIdx} OR email ILIKE $${paramIdx})`);
      params.push(`%${filters.search}%`);
      paramIdx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(`SELECT COUNT(*) FROM customers ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    params.push(limit, offset);

    const result = await pool.query(
      `SELECT * FROM customers ${where} ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      params
    );

    return { customers: result.rows, total };
  },

  async create(data: {
    full_name: string;
    phone?: string;
    email?: string;
    address_line?: string;
    city?: string;
    country?: string;
  }): Promise<Customer> {
    const result = await pool.query(
      `INSERT INTO customers (full_name, phone, email, address_line, city, country)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [data.full_name, data.phone ?? null, data.email ?? null, data.address_line ?? null, data.city ?? null, data.country ?? null]
    );
    return result.rows[0];
  },

  async update(id: string, data: {
    full_name?: string;
    phone?: string;
    email?: string;
    address_line?: string;
    city?: string;
    country?: string;
  }): Promise<Customer | null> {
    const fields: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIdx++}`);
        params.push(value);
      }
    }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = now()`);
    params.push(id);

    const result = await pool.query(
      `UPDATE customers SET ${fields.join(', ')} WHERE id = $${paramIdx}
       RETURNING *`,
      params
    );
    return result.rows[0] || null;
  },
};
