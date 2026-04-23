import { Router } from 'express';
import { isAuthenticated, isAdminOrEmployee } from '../auth/middleware.js';
import { validate, validateParams } from '../middleware/validate.js';
import {
  createCarDocumentSchema,
  updateCarDocumentSchema,
  carIdParamSchema,
  carDocumentParamSchema,
} from '../validation/schemas.js';
import { carDocumentsRepo } from '../db/repositories/car-documents.repo.js';
import { carsRepo } from '../db/repositories/cars.repo.js';
import { getParam } from '../utils/params.js';
import type { Request, Response } from 'express';

const router = Router();

router.use(isAuthenticated, isAdminOrEmployee);

router.post('/:carId/documents', validateParams(carIdParamSchema), validate(createCarDocumentSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const carId = getParam(req, 'carId');
    const car = await carsRepo.findById(carId);
    if (!car) {
      res.status(404).json({ error: 'Car not found', code: 'CAR_NOT_FOUND' });
      return;
    }

    const doc = await carDocumentsRepo.create(carId, {
      ...req.body,
      created_by_user_id: req.user!.id,
    });
    res.status(201).json(doc);
  } catch (err) {
    console.error('Error creating car document:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:carId/documents', validateParams(carIdParamSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const carId = getParam(req, 'carId');
    const car = await carsRepo.findById(carId);
    if (!car) {
      res.status(404).json({ error: 'Car not found', code: 'CAR_NOT_FOUND' });
      return;
    }

    const docs = await carDocumentsRepo.findAllByCar(carId);
    res.json(docs);
  } catch (err) {
    console.error('Error listing car documents:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:carId/documents/:id', validateParams(carDocumentParamSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await carDocumentsRepo.findById(getParam(req, 'carId'), getParam(req, 'id'));
    if (!doc) {
      res.status(404).json({ error: 'Document not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(doc);
  } catch (err) {
    console.error('Error getting car document:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:carId/documents/:id', validateParams(carDocumentParamSchema), validate(updateCarDocumentSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await carDocumentsRepo.update(getParam(req, 'carId'), getParam(req, 'id'), req.body);
    if (!doc) {
      res.status(404).json({ error: 'Document not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(doc);
  } catch (err) {
    console.error('Error updating car document:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:carId/documents/:id', validateParams(carDocumentParamSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await carDocumentsRepo.delete(getParam(req, 'carId'), getParam(req, 'id'));
    if (!result.success) {
      res.status(404).json({ error: 'Document not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ message: 'Document deleted successfully' });
  } catch (err) {
    console.error('Error deleting car document:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
