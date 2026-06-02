import { pool } from '../pool.js';
import type { Feedback } from '../../types/models.js';

export const feedbackRepo = {
  async create(data: {
    stars: number;
    name: string;
    message: string;
  }): Promise<Feedback> {
    const result = await pool.query(
      `INSERT INTO feedback (stars, name, message)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.stars, data.name, data.message]
    );
    return result.rows[0];
  },

  async findPublic(
    filters: { limit?: number; offset?: number } = {}
  ): Promise<{ feedback: Feedback[]; total: number }> {
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM feedback WHERE is_approved = true`
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const limit = filters.limit ?? 20;
    const offset = filters.offset ?? 0;

    const result = await pool.query(
      `SELECT * FROM feedback
       WHERE is_approved = true
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return { feedback: result.rows, total };
  },

  async findAll(filters: { is_approved?: boolean } = {}): Promise<Feedback[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filters.is_approved !== undefined) {
      conditions.push(`is_approved = $${paramIdx++}`);
      params.push(filters.is_approved);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM feedback ${where} ORDER BY created_at DESC`,
      params
    );
    return result.rows;
  },

  async findById(id: string): Promise<Feedback | null> {
    const result = await pool.query('SELECT * FROM feedback WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  async setApproved(id: string, isApproved: boolean): Promise<Feedback | null> {
    const result = await pool.query(
      `UPDATE feedback SET is_approved = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [isApproved, id]
    );
    return result.rows[0] || null;
  },

  async delete(id: string): Promise<{ success: boolean }> {
    const result = await pool.query('DELETE FROM feedback WHERE id = $1', [id]);
    return { success: (result.rowCount ?? 0) > 0 };
  },
};
