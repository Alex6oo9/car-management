import { pool } from '../pool.js';
import type { Purchase } from '../../types/models.js';

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['paid', 'cancelled'],
  paid: ['refunded'],
  cancelled: [],
  refunded: [],
};

export const purchasesRepo = {
  async findById(id: string): Promise<Purchase | null> {
    const result = await pool.query(
      `SELECT p.*,
              c.brand AS car_brand, c.model AS car_model, c.year AS car_year, c.vin AS car_vin,
              cu.full_name AS customer_name, cu.phone AS customer_phone, cu.email AS customer_email
       FROM purchases p
       LEFT JOIN cars c ON p.car_id = c.id
       LEFT JOIN customers cu ON p.customer_id = cu.id
       WHERE p.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  async findAll(filters: {
    car_id?: string;
    customer_id?: string;
    status?: string;
  } = {}): Promise<{ purchases: Purchase[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filters.car_id) {
      conditions.push(`p.car_id = $${paramIdx++}`);
      params.push(filters.car_id);
    }
    if (filters.customer_id) {
      conditions.push(`p.customer_id = $${paramIdx++}`);
      params.push(filters.customer_id);
    }
    if (filters.status) {
      conditions.push(`p.status = $${paramIdx++}`);
      params.push(filters.status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM purchases p ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await pool.query(
      `SELECT p.*,
              c.brand AS car_brand, c.model AS car_model, c.year AS car_year,
              cu.full_name AS customer_name
       FROM purchases p
       LEFT JOIN cars c ON p.car_id = c.id
       LEFT JOIN customers cu ON p.customer_id = cu.id
       ${where} ORDER BY p.created_at DESC`,
      params
    );

    return { purchases: result.rows, total };
  },

  async create(data: {
    car_id: string;
    customer_id: string;
    sale_price: number;
    currency_code?: string;
    created_by_user_id?: string;
  }): Promise<Purchase> {
    const result = await pool.query(
      `INSERT INTO purchases (car_id, customer_id, sale_price, currency_code, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.car_id, data.customer_id, data.sale_price, data.currency_code ?? 'THB', data.created_by_user_id ?? null]
    );
    return result.rows[0];
  },

  async updateStatus(id: string, status: string): Promise<{ purchase: Purchase | null; error?: string }> {
    const current = await pool.query('SELECT status, car_id FROM purchases WHERE id = $1', [id]);
    if (current.rows.length === 0) {
      return { purchase: null, error: 'Purchase not found' };
    }

    const currentStatus = current.rows[0].status;
    const carId = current.rows[0].car_id;

    const allowed = VALID_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(status)) {
      return { purchase: null, error: `Cannot transition from '${currentStatus}' to '${status}'` };
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE purchases SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
        [status, id]
      );

      if (status === 'paid') {
        await client.query(
          `UPDATE cars SET status = 'sold', updated_at = now() WHERE id = $1`,
          [carId]
        );
      }

      await client.query('COMMIT');
      return { purchase: result.rows[0] };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};
