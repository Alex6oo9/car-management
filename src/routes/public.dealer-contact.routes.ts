import { Router } from 'express';
import { dealerContactsRepo } from '../db/repositories/dealer-contacts.repo.js';
import type { Request, Response } from 'express';

const router = Router();

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const contact = await dealerContactsRepo.get();
    if (!contact) {
      res.status(404).json({ error: 'Dealer contact not configured', code: 'NOT_FOUND' });
      return;
    }
    res.json(contact);
  } catch (err) {
    console.error('Error getting public dealer contact:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
