import { Router } from 'express';
import { isAuthenticated, isAdminOrEmployee } from '../auth/middleware.js';
import { validate, validateParams } from '../middleware/validate.js';
import { createPurchaseSchema, updatePurchaseStatusSchema, uuidParamSchema } from '../validation/schemas.js';
import { purchasesRepo } from '../db/repositories/purchases.repo.js';
import { carsRepo } from '../db/repositories/cars.repo.js';
import { customersRepo } from '../db/repositories/customers.repo.js';
import { getParam } from '../utils/params.js';
import type { Request, Response } from 'express';

const router = Router();

router.use(isAuthenticated, isAdminOrEmployee);

router.post('/', validate(createPurchaseSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { car_id, customer_id } = req.body;

    // Validate car exists and is available
    const car = await carsRepo.findById(car_id);
    if (!car) {
      res.status(404).json({ error: 'Car not found', code: 'NOT_FOUND' });
      return;
    }
    if (car.status !== 'available') {
      res.status(400).json({
        error: `Car is not available for purchase (current status: ${car.status})`,
        code: 'CAR_NOT_AVAILABLE',
      });
      return;
    }

    // Validate customer exists
    const customer = await customersRepo.findById(customer_id);
    if (!customer) {
      res.status(404).json({ error: 'Customer not found', code: 'NOT_FOUND' });
      return;
    }

    // Snapshot sale price
    const salePrice = parseFloat(String(car.sale_price ?? 0));

    const purchase = await purchasesRepo.create({
      car_id,
      customer_id,
      sale_price: salePrice,
      currency_code: car.currency_code,
      created_by_user_id: req.user!.id,
    });

    res.status(201).json(purchase);
  } catch (err) {
    console.error('Error creating purchase:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const filters = {
      car_id: req.query.car_id as string | undefined,
      customer_id: req.query.customer_id as string | undefined,
      status: req.query.status as string | undefined,
    };

    const result = await purchasesRepo.findAll(filters);
    res.json(result);
  } catch (err) {
    console.error('Error listing purchases:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', validateParams(uuidParamSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const purchase = await purchasesRepo.findById(getParam(req, 'id'));
    if (!purchase) {
      res.status(404).json({ error: 'Purchase not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(purchase);
  } catch (err) {
    console.error('Error getting purchase:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id/status', validateParams(uuidParamSchema), validate(updatePurchaseStatusSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    const result = await purchasesRepo.updateStatus(getParam(req, 'id'), status);

    if (result.error) {
      const statusCode = result.purchase === null && result.error === 'Purchase not found' ? 404 : 400;
      if (result.error.includes('Cannot transition')) {
        res.status(400).json({ error: result.error, code: 'STATUS_TRANSITION_ERROR' });
        return;
      }
      res.status(statusCode).json({ error: result.error, code: 'ERROR' });
      return;
    }

    res.json(result.purchase);
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'Car already sold', code: 'CAR_ALREADY_SOLD' });
      return;
    }
    console.error('Error updating purchase status:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
