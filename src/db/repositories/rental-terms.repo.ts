import { pool } from '../pool.js';
import type { RentalTerm } from '../../types/models.js';

export const rentalTermsRepo = {
  async findAll(filters: { is_active?: boolean } = {}): Promise<RentalTerm[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filters.is_active !== undefined) {
      conditions.push(`is_active = $${paramIdx++}`);
      params.push(filters.is_active);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM rental_terms ${where} ORDER BY sort_order ASC, created_at DESC`,
      params
    );
    return result.rows;
  },

  async findById(id: string): Promise<RentalTerm | null> {
    const result = await pool.query('SELECT * FROM rental_terms WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  async create(data: {
    title: string;
    description: string;
    is_active?: boolean;
    sort_order?: number;
    created_by_user_id?: string;
  }): Promise<RentalTerm> {
    const result = await pool.query(
      `INSERT INTO rental_terms (title, description, is_active, sort_order, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        data.title,
        data.description,
        data.is_active ?? true,
        data.sort_order ?? 0,
        data.created_by_user_id ?? null,
      ]
    );
    return result.rows[0];
  },

  async update(id: string, data: Record<string, unknown>): Promise<RentalTerm | null> {
    const allowedFields = ['title', 'description', 'is_active', 'sort_order'];

    const fields: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    for (const [key, value] of Object.entries(data)) {
      if (allowedFields.includes(key) && value !== undefined) {
        fields.push(`${key} = $${paramIdx++}`);
        params.push(value);
      }
    }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = now()`);
    params.push(id);

    const result = await pool.query(
      `UPDATE rental_terms SET ${fields.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  },

  async delete(id: string): Promise<{ success: boolean }> {
    const result = await pool.query('DELETE FROM rental_terms WHERE id = $1', [id]);
    return { success: (result.rowCount ?? 0) > 0 };
  },
};
