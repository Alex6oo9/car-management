import { Router } from 'express';
import { isAuthenticated, isAdminOrEmployee } from '../auth/middleware.js';
import { validate, validateParams } from '../middleware/validate.js';
import { createRentalSchema, updateRentalStatusSchema, uuidParamSchema } from '../validation/schemas.js';
import { rentalsRepo } from '../db/repositories/rentals.repo.js';
import { carsRepo } from '../db/repositories/cars.repo.js';
import { customersRepo } from '../db/repositories/customers.repo.js';
import { getParam } from '../utils/params.js';
import type { Request, Response } from 'express';

const router = Router();

router.use(isAuthenticated, isAdminOrEmployee);

router.post('/', validate(createRentalSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { car_id, customer_id, start_date, end_date, deposit_amount } = req.body;

    // Validate car exists and is available
    const car = await carsRepo.findById(car_id);
    if (!car) {
      res.status(404).json({ error: 'Car not found', code: 'NOT_FOUND' });
      return;
    }
    if (car.status === 'sold') {
      res.status(400).json({ error: 'Car is sold and cannot be rented', code: 'CAR_SOLD' });
      return;
    }
    if (car.status === 'maintenance') {
      res.status(400).json({ error: 'Car is in maintenance and cannot be rented', code: 'CAR_MAINTENANCE' });
      return;
    }

    // Validate customer exists
    const customer = await customersRepo.findById(customer_id);
    if (!customer) {
      res.status(404).json({ error: 'Customer not found', code: 'NOT_FOUND' });
      return;
    }

    // Check date overlap
    const hasOverlap = await rentalsRepo.checkOverlap(car_id, start_date, end_date);
    if (hasOverlap) {
      res.status(409).json({ error: 'Car is not available for the selected dates', code: 'DATE_OVERLAP' });
      return;
    }

    // Snapshot price and calculate total
    const pricePerDay = parseFloat(String(car.rent_price_per_day ?? 0));
    const startMs = new Date(start_date).getTime();
    const endMs = new Date(end_date).getTime();
    const days = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1; // inclusive
    const totalPrice = days * pricePerDay;

    const rental = await rentalsRepo.create({
      car_id,
      customer_id,
      start_date,
      end_date,
      price_per_day: pricePerDay,
      total_price: totalPrice,
      deposit_amount,
      currency_code: car.currency_code,
      created_by_user_id: req.user!.id,
    });

    res.status(201).json(rental);
  } catch (err) {
    console.error('Error creating rental:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const filters = {
      car_id: req.query.car_id as string | undefined,
      customer_id: req.query.customer_id as string | undefined,
      status: req.query.status as string | undefined,
      start_date_from: req.query.start_date_from as string | undefined,
      start_date_to: req.query.start_date_to as string | undefined,
    };

    const result = await rentalsRepo.findAll(filters);
    res.json(result);
  } catch (err) {
    console.error('Error listing rentals:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', validateParams(uuidParamSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const rental = await rentalsRepo.findById(getParam(req, 'id'));
    if (!rental) {
      res.status(404).json({ error: 'Rental not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(rental);
  } catch (err) {
    console.error('Error getting rental:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id/status', validateParams(uuidParamSchema), validate(updateRentalStatusSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, cancelled_reason } = req.body;
    const result = await rentalsRepo.updateStatus(getParam(req, 'id'), status, cancelled_reason);

    if (result.error) {
      const statusCode = result.rental === null && result.error === 'Rental not found' ? 404 : 400;
      res.status(statusCode).json({ error: result.error, code: 'STATUS_TRANSITION_ERROR' });
      return;
    }

    res.json(result.rental);
  } catch (err) {
    console.error('Error updating rental status:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
