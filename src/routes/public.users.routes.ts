import { Router } from 'express';
import { usersRepo } from '../db/repositories/users.repo.js';
import type { Request, Response } from 'express';

const router = Router();

router.get('/team', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await usersRepo.findAll({ role: 'employee', is_active: true });
    const team = result.users.map((user) => ({
      id: user.id,
      name: user.full_name,
      email: user.email,
      avatar: null,
      role: user.role,
    }));

    res.json({ users: team, total: team.length });
  } catch (err) {
    console.error('Error listing public team:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
