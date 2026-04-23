import { Router } from 'express';
import { isAuthenticated, isAdminOrEmployee } from '../auth/middleware.js';
import { validate, validateParams } from '../middleware/validate.js';
import { createRentalTermSchema, updateRentalTermSchema, uuidParamSchema } from '../validation/schemas.js';
import { rentalTermsRepo } from '../db/repositories/rental-terms.repo.js';
import { getParam } from '../utils/params.js';
import type { Request, Response } from 'express';

const router = Router();

router.use(isAuthenticated, isAdminOrEmployee);

router.post('/', validate(createRentalTermSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const term = await rentalTermsRepo.create({
      ...req.body,
      created_by_user_id: req.user!.id,
    });
    res.status(201).json(term);
  } catch (err) {
    console.error('Error creating rental term:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const is_active =
      req.query.is_active === 'true' ? true :
      req.query.is_active === 'false' ? false :
      undefined;

    const terms = await rentalTermsRepo.findAll({ is_active });
    res.json(terms);
  } catch (err) {
    console.error('Error listing rental terms:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', validateParams(uuidParamSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const term = await rentalTermsRepo.findById(getParam(req, 'id'));
    if (!term) {
      res.status(404).json({ error: 'Rental term not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(term);
  } catch (err) {
    console.error('Error getting rental term:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', validateParams(uuidParamSchema), validate(updateRentalTermSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const term = await rentalTermsRepo.update(getParam(req, 'id'), req.body);
    if (!term) {
      res.status(404).json({ error: 'Rental term not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(term);
  } catch (err) {
    console.error('Error updating rental term:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', validateParams(uuidParamSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await rentalTermsRepo.delete(getParam(req, 'id'));
    if (!result.success) {
      res.status(404).json({ error: 'Rental term not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ message: 'Rental term deleted successfully' });
  } catch (err) {
    console.error('Error deleting rental term:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
