import { Router } from 'express';
import { isAuthenticated } from '../auth/middleware.js';
import { validate } from '../middleware/validate.js';
import { updateProfileSchema } from '../validation/schemas.js';
import { usersRepo } from '../db/repositories/users.repo.js';
import type { Request, Response } from 'express';

const router = Router();

router.use(isAuthenticated);

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const profile = await usersRepo.getProfileById(req.user!.id);
    if (!profile) {
      res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(profile);
  } catch (err) {
    console.error('Error getting profile:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/', validate(updateProfileSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const updated = await usersRepo.updateProfile(req.user!.id, req.body);
    res.json(updated);
  } catch (err: any) {
    if (err.message === 'User not found') {
      res.status(404).json({ error: err.message, code: 'NOT_FOUND' });
      return;
    }
    console.error('Error updating profile:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
