import { pool } from '../pool.js';
import type { CarDocument } from '../../types/models.js';

export const carDocumentsRepo = {
  async findAllByCar(carId: string): Promise<CarDocument[]> {
    const result = await pool.query(
      'SELECT * FROM car_documents WHERE car_id = $1 ORDER BY sort_order ASC',
      [carId]
    );
    return result.rows;
  },

  async findById(carId: string, id: string): Promise<CarDocument | null> {
    const result = await pool.query(
      'SELECT * FROM car_documents WHERE car_id = $1 AND id = $2',
      [carId, id]
    );
    return result.rows[0] || null;
  },

  async create(carId: string, data: {
    field_name: string;
    field_value: string;
    sort_order?: number;
    created_by_user_id?: string;
  }): Promise<CarDocument> {
    const result = await pool.query(
      `INSERT INTO car_documents (car_id, field_name, field_value, sort_order, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        carId,
        data.field_name,
        data.field_value,
        data.sort_order ?? 0,
        data.created_by_user_id ?? null,
      ]
    );
    return result.rows[0];
  },

  async update(carId: string, id: string, data: Record<string, unknown>): Promise<CarDocument | null> {
    const allowedFields = ['field_name', 'field_value', 'sort_order'];

    const fields: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    for (const [key, value] of Object.entries(data)) {
      if (allowedFields.includes(key) && value !== undefined) {
        fields.push(`${key} = $${paramIdx++}`);
        params.push(value);
      }
    }

    if (fields.length === 0) return this.findById(carId, id);

    fields.push(`updated_at = now()`);
    params.push(carId, id);

    const result = await pool.query(
      `UPDATE car_documents SET ${fields.join(', ')} WHERE car_id = $${paramIdx++} AND id = $${paramIdx} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  },

  async delete(carId: string, id: string): Promise<{ success: boolean }> {
    const result = await pool.query(
      'DELETE FROM car_documents WHERE car_id = $1 AND id = $2',
      [carId, id]
    );
    return { success: (result.rowCount ?? 0) > 0 };
  },
};
