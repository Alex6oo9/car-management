import { Router } from 'express';
import { validateParams } from '../middleware/validate.js';
import { uuidParamSchema } from '../validation/schemas.js';
import { carsRepo } from '../db/repositories/cars.repo.js';
import { getParam } from '../utils/params.js';
import type { Request, Response } from 'express';

const router = Router();

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const filters = {
      brand: req.query.brand as string | undefined,
      model: req.query.model as string | undefined,
      year_min: req.query.year_min ? parseInt(req.query.year_min as string, 10) : undefined,
      year_max: req.query.year_max ? parseInt(req.query.year_max as string, 10) : undefined,
      price_min: req.query.price_min ? parseFloat(req.query.price_min as string) : undefined,
      price_max: req.query.price_max ? parseFloat(req.query.price_max as string) : undefined,
      rent_price_min: req.query.rent_price_min ? parseFloat(req.query.rent_price_min as string) : undefined,
      rent_price_max: req.query.rent_price_max ? parseFloat(req.query.rent_price_max as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    };

    const result = await carsRepo.findAllPublic(filters);
    res.json(result);
  } catch (err) {
    console.error('Error listing public cars:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', validateParams(uuidParamSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const car = await carsRepo.findById(getParam(req, 'id'));
    if (!car) {
      res.status(404).json({ error: 'Car not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(car);
  } catch (err) {
    console.error('Error getting car:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
