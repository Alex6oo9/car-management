import { Router } from 'express';
import { rentalTermsRepo } from '../db/repositories/rental-terms.repo.js';
import type { Request, Response } from 'express';

const router = Router();

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const terms = await rentalTermsRepo.findAll({ is_active: true });
    res.json(terms);
  } catch (err) {
    console.error('Error listing public rental terms:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
