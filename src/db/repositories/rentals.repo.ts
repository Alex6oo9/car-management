import { pool } from '../pool.js';
import type { Rental } from '../../types/models.js';
import { isValidRentalTransition, type RentalStatus } from '../../utils/rental.js';

export const rentalsRepo = {
  async checkOverlap(carId: string, startDate: string, endDate: string, excludeRentalId?: string): Promise<boolean> {
    const params: unknown[] = [carId, startDate, endDate];
    let excludeClause = '';
    if (excludeRentalId) {
      excludeClause = ' AND id != $4';
      params.push(excludeRentalId);
    }

    const result = await pool.query(
      `SELECT id FROM rentals
       WHERE car_id = $1
         AND status IN ('pending', 'confirmed', 'active')
         AND start_date <= $3
         AND end_date >= $2
         ${excludeClause}`,
      params
    );
    return result.rows.length > 0;
  },

  async findById(id: string): Promise<Rental | null> {
    const result = await pool.query(
      `SELECT r.*,
              c.brand AS car_brand, c.model AS car_model, c.year AS car_year,
              cu.full_name AS customer_name, cu.phone AS customer_phone, cu.email AS customer_email
       FROM rentals r
       LEFT JOIN cars c ON r.car_id = c.id
       LEFT JOIN customers cu ON r.customer_id = cu.id
       WHERE r.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  async findAll(filters: {
    car_id?: string;
    customer_id?: string;
    status?: string;
    start_date_from?: string;
    start_date_to?: string;
  } = {}): Promise<{ rentals: Rental[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filters.car_id) {
      conditions.push(`r.car_id = $${paramIdx++}`);
      params.push(filters.car_id);
    }
    if (filters.customer_id) {
      conditions.push(`r.customer_id = $${paramIdx++}`);
      params.push(filters.customer_id);
    }
    if (filters.status) {
      conditions.push(`r.status = $${paramIdx++}`);
      params.push(filters.status);
    }
    if (filters.start_date_from) {
      conditions.push(`r.start_date >= $${paramIdx++}`);
      params.push(filters.start_date_from);
    }
    if (filters.start_date_to) {
      conditions.push(`r.start_date <= $${paramIdx++}`);
      params.push(filters.start_date_to);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM rentals r ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await pool.query(
      `SELECT r.*,
              c.brand AS car_brand, c.model AS car_model, c.year AS car_year,
              cu.full_name AS customer_name
       FROM rentals r
       LEFT JOIN cars c ON r.car_id = c.id
       LEFT JOIN customers cu ON r.customer_id = cu.id
       ${where} ORDER BY r.created_at DESC`,
      params
    );

    return { rentals: result.rows, total };
  },

  async create(data: {
    car_id: string;
    customer_id: string;
    start_date: string;
    end_date: string;
    price_per_day: number;
    total_price: number;
    deposit_amount?: number;
    currency_code?: string;
    created_by_user_id?: string;
  }): Promise<Rental> {
    const result = await pool.query(
      `INSERT INTO rentals (car_id, customer_id, start_date, end_date, price_per_day, total_price, deposit_amount, currency_code, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        data.car_id, data.customer_id, data.start_date, data.end_date,
        data.price_per_day, data.total_price, data.deposit_amount ?? 0,
        data.currency_code ?? 'THB', data.created_by_user_id ?? null,
      ]
    );
    return result.rows[0];
  },

  async updateStatus(id: string, status: string, cancelledReason?: string): Promise<{ rental: Rental | null; error?: string }> {
    const current = await pool.query('SELECT status, car_id FROM rentals WHERE id = $1', [id]);
    if (current.rows.length === 0) {
      return { rental: null, error: 'Rental not found' };
    }

    const currentStatus = current.rows[0].status;
    const carId = current.rows[0].car_id;

    if (!isValidRentalTransition(currentStatus as RentalStatus, status as RentalStatus)) {
      return { rental: null, error: `Cannot transition from '${currentStatus}' to '${status}'` };
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE rentals SET status = $1, cancelled_reason = $2, updated_at = now()
         WHERE id = $3 RETURNING *`,
        [status, cancelledReason ?? null, id]
      );

      // Side effects on car status
      if (status === 'active') {
        await client.query(
          `UPDATE cars SET status = 'rented', updated_at = now() WHERE id = $1`,
          [carId]
        );
      } else if (status === 'completed' || status === 'cancelled') {
        // Only set back to available if no other active rentals
        const otherActive = await client.query(
          `SELECT id FROM rentals WHERE car_id = $1 AND status = 'active' AND id != $2 LIMIT 1`,
          [carId, id]
        );
        if (otherActive.rows.length === 0) {
          await client.query(
            `UPDATE cars SET status = 'available', updated_at = now() WHERE id = $1 AND status = 'rented'`,
            [carId]
          );
        }
      }

      await client.query('COMMIT');
      return { rental: result.rows[0] };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};
