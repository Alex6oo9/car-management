import { Router } from 'express';
import { isAuthenticated, isAdminOrEmployee } from '../auth/middleware.js';
import { validate, validateParams } from '../middleware/validate.js';
import { createCarSchema, updateCarSchema, publishCarSchema, createCarImageSchema, uuidParamSchema } from '../validation/schemas.js';
import { carsRepo } from '../db/repositories/cars.repo.js';
import { getParam } from '../utils/params.js';
import type { Request, Response } from 'express';

const router = Router();

router.use(isAuthenticated, isAdminOrEmployee);

router.post('/', validate(createCarSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const car = await carsRepo.create({
      ...req.body,
      created_by_user_id: req.user!.id,
    });
    res.status(201).json(car);
  } catch (err: any) {
    if (err.code === '23505' && err.constraint?.includes('vin')) {
      res.status(409).json({ error: 'VIN already exists', code: 'DUPLICATE_VIN' });
      return;
    }
    console.error('Error creating car:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;
    const result = await carsRepo.findAllAdmin({ limit, offset });
    res.json(result);
  } catch (err) {
    console.error('Error listing cars:', err);
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

router.patch('/:id', validateParams(uuidParamSchema), validate(updateCarSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const car = await carsRepo.update(getParam(req, 'id'), req.body);
    if (!car) {
      res.status(404).json({ error: 'Car not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(car);
  } catch (err: any) {
    if (err.code === '23505' && err.constraint?.includes('vin')) {
      res.status(409).json({ error: 'VIN already exists', code: 'DUPLICATE_VIN' });
      return;
    }
    console.error('Error updating car:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', validateParams(uuidParamSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await carsRepo.delete(getParam(req, 'id'));
    if (!result.success) {
      res.status(400).json({ error: result.error, code: 'DELETE_BLOCKED' });
      return;
    }
    res.json({ message: 'Car deleted successfully' });
  } catch (err) {
    console.error('Error deleting car:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id/publish', validateParams(uuidParamSchema), validate(publishCarSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const car = await carsRepo.update(getParam(req, 'id'), { is_published: req.body.is_published });
    if (!car) {
      res.status(404).json({ error: 'Car not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(car);
  } catch (err) {
    console.error('Error publishing car:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/images', validateParams(uuidParamSchema), validate(createCarImageSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const car = await carsRepo.findById(getParam(req, 'id'));
    if (!car) {
      res.status(404).json({ error: 'Car not found', code: 'NOT_FOUND' });
      return;
    }

    const image = await carsRepo.addImage(getParam(req, 'id'), req.body);
    res.status(201).json(image);
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'Sort order conflict or duplicate primary image', code: 'CONSTRAINT_VIOLATION' });
      return;
    }
    console.error('Error adding car image:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
