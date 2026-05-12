import { pool } from '../pool.js';
import type { DealerContact } from '../../types/models.js';

export const dealerContactsRepo = {
  async get(): Promise<DealerContact | null> {
    const result = await pool.query('SELECT * FROM dealer_contacts LIMIT 1');
    return result.rows[0] || null;
  },

  async update(data: Partial<DealerContact>): Promise<DealerContact> {
    const allowedFields = [
      'showroom_name', 'open_day_from', 'open_day_to', 'open_time_from', 'open_time_to',
      'status', 'phone_number', 'line_contact', 'facebook_url', 'instagram_url',
      'gmail', 'viber_contact', 'wechat_contact', 'map_url',
    ];

    const existing = await pool.query('SELECT id FROM dealer_contacts LIMIT 1');
    if (existing.rows.length === 0) {
      throw new Error('Dealer contact record not found');
    }
    const id = existing.rows[0].id;

    const fields: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    for (const [key, value] of Object.entries(data)) {
      if (allowedFields.includes(key) && value !== undefined) {
        fields.push(`${key} = $${paramIdx++}`);
        params.push(value);
      }
    }

    if (fields.length === 0) {
      const r = await pool.query('SELECT * FROM dealer_contacts WHERE id = $1', [id]);
      return r.rows[0];
    }

    fields.push(`updated_at = now()`);
    params.push(id);

    const result = await pool.query(
      `UPDATE dealer_contacts SET ${fields.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      params
    );
    return result.rows[0];
  },
};
