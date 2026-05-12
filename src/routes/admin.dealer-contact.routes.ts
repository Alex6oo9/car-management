import { Router } from 'express';
import { isAuthenticated, isAdminOrEmployee } from '../auth/middleware.js';
import { validate } from '../middleware/validate.js';
import { updateDealerContactSchema } from '../validation/schemas.js';
import { dealerContactsRepo } from '../db/repositories/dealer-contacts.repo.js';
import type { Request, Response } from 'express';

const router = Router();

router.use(isAuthenticated, isAdminOrEmployee);

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const contact = await dealerContactsRepo.get();
    if (!contact) {
      res.status(404).json({ error: 'Dealer contact not configured', code: 'NOT_FOUND' });
      return;
    }
    res.json(contact);
  } catch (err) {
    console.error('Error getting admin dealer contact:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/', validate(updateDealerContactSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const contact = await dealerContactsRepo.update(req.body);
    res.json(contact);
  } catch (err: any) {
    if (err.message === 'Dealer contact record not found') {
      res.status(404).json({ error: err.message, code: 'NOT_FOUND' });
      return;
    }
    console.error('Error updating dealer contact:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
