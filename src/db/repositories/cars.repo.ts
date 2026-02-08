import { pool } from '../pool.js';
import type { Car, CarImage } from '../../types/models.js';

export const carsRepo = {
  async findById(id: string): Promise<(Car & { images: CarImage[] }) | null> {
    const carResult = await pool.query('SELECT * FROM cars WHERE id = $1', [id]);
    if (carResult.rows.length === 0) return null;

    const imagesResult = await pool.query(
      'SELECT * FROM car_images WHERE car_id = $1 ORDER BY sort_order',
      [id]
    );

    return { ...carResult.rows[0], images: imagesResult.rows };
  },

  async findAllPublic(filters: {
    brand?: string;
    model?: string;
    year_min?: number;
    year_max?: number;
    price_min?: number;
    price_max?: number;
    rent_price_min?: number;
    rent_price_max?: number;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ cars: (Car & { images: CarImage[] })[]; total: number }> {
    const conditions: string[] = ['is_published = true'];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filters.brand) {
      conditions.push(`brand ILIKE $${paramIdx++}`);
      params.push(`%${filters.brand}%`);
    }
    if (filters.model) {
      conditions.push(`model ILIKE $${paramIdx++}`);
      params.push(`%${filters.model}%`);
    }
    if (filters.year_min) {
      conditions.push(`year >= $${paramIdx++}`);
      params.push(filters.year_min);
    }
    if (filters.year_max) {
      conditions.push(`year <= $${paramIdx++}`);
      params.push(filters.year_max);
    }
    if (filters.price_min) {
      conditions.push(`sale_price >= $${paramIdx++}`);
      params.push(filters.price_min);
    }
    if (filters.price_max) {
      conditions.push(`sale_price <= $${paramIdx++}`);
      params.push(filters.price_max);
    }
    if (filters.rent_price_min) {
      conditions.push(`rent_price_per_day >= $${paramIdx++}`);
      params.push(filters.rent_price_min);
    }
    if (filters.rent_price_max) {
      conditions.push(`rent_price_per_day <= $${paramIdx++}`);
      params.push(filters.rent_price_max);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pool.query(`SELECT COUNT(*) FROM cars ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const limit = filters.limit ?? 20;
    const offset = filters.offset ?? 0;
    params.push(limit, offset);

    const carsResult = await pool.query(
      `SELECT * FROM cars ${where} ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      params
    );

    const cars = [];
    for (const car of carsResult.rows) {
      const imagesResult = await pool.query(
        'SELECT * FROM car_images WHERE car_id = $1 ORDER BY sort_order',
        [car.id]
      );
      cars.push({ ...car, images: imagesResult.rows });
    }

    return { cars, total };
  },

  async findAllAdmin(filters: {
    limit?: number;
    offset?: number;
  } = {}): Promise<{ cars: (Car & { images: CarImage[] })[]; total: number }> {
    const countResult = await pool.query('SELECT COUNT(*) FROM cars');
    const total = parseInt(countResult.rows[0].count, 10);

    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    const carsResult = await pool.query(
      'SELECT * FROM cars ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    const cars = [];
    for (const car of carsResult.rows) {
      const imagesResult = await pool.query(
        'SELECT * FROM car_images WHERE car_id = $1 ORDER BY sort_order',
        [car.id]
      );
      cars.push({ ...car, images: imagesResult.rows });
    }

    return { cars, total };
  },

  async create(data: {
    vin?: string;
    brand: string;
    model: string;
    year: number;
    mileage_km?: number;
    sale_price?: number;
    rent_price_per_day?: number;
    currency_code?: string;
    status?: string;
    is_published?: boolean;
    created_by_user_id?: string;
  }): Promise<Car> {
    const result = await pool.query(
      `INSERT INTO cars (vin, brand, model, year, mileage_km, sale_price, rent_price_per_day, currency_code, status, is_published, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        data.vin ?? null, data.brand, data.model, data.year,
        data.mileage_km ?? 0, data.sale_price ?? null, data.rent_price_per_day ?? null,
        data.currency_code ?? 'THB', data.status ?? 'available',
        data.is_published ?? false, data.created_by_user_id ?? null,
      ]
    );
    return result.rows[0];
  },

  async update(id: string, data: Record<string, unknown>): Promise<Car | null> {
    const allowedFields = [
      'vin', 'brand', 'model', 'year', 'mileage_km', 'sale_price',
      'rent_price_per_day', 'currency_code', 'status', 'is_published',
    ];

    const fields: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    for (const [key, value] of Object.entries(data)) {
      if (allowedFields.includes(key) && value !== undefined) {
        fields.push(`${key} = $${paramIdx++}`);
        params.push(value);
      }
    }

    if (fields.length === 0) return (await this.findById(id)) as Car | null;

    fields.push(`updated_at = now()`);
    params.push(id);

    const result = await pool.query(
      `UPDATE cars SET ${fields.join(', ')} WHERE id = $${paramIdx}
       RETURNING *`,
      params
    );
    return result.rows[0] || null;
  },

  async delete(id: string): Promise<{ success: boolean; error?: string }> {
    const rentals = await pool.query(
      'SELECT id FROM rentals WHERE car_id = $1 LIMIT 1',
      [id]
    );
    if (rentals.rows.length > 0) {
      return { success: false, error: 'Cannot delete car with existing rentals' };
    }

    const purchases = await pool.query(
      'SELECT id FROM purchases WHERE car_id = $1 LIMIT 1',
      [id]
    );
    if (purchases.rows.length > 0) {
      return { success: false, error: 'Cannot delete car with existing purchases' };
    }

    const result = await pool.query('DELETE FROM cars WHERE id = $1', [id]);
    return { success: (result.rowCount ?? 0) > 0 };
  },

  async addImage(carId: string, data: {
    storage_path: string;
    is_primary?: boolean;
    sort_order?: number;
  }): Promise<CarImage> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (data.is_primary) {
        await client.query(
          'UPDATE car_images SET is_primary = false WHERE car_id = $1 AND is_primary = true',
          [carId]
        );
      }

      const result = await client.query(
        `INSERT INTO car_images (car_id, storage_path, is_primary, sort_order)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [carId, data.storage_path, data.is_primary ?? false, data.sort_order ?? 0]
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async updateStatus(id: string, status: string): Promise<Car | null> {
    const result = await pool.query(
      `UPDATE cars SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return result.rows[0] || null;
  },
};
