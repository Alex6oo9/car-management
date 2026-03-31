import { Router } from 'express';
import bcrypt from 'bcrypt';
import { isAuthenticated, isAdmin } from '../auth/middleware.js';
import { validate, validateParams } from '../middleware/validate.js';
import { createUserSchema, updateUserSchema, updateUserRoleSchema, uuidParamSchema } from '../validation/schemas.js';
import { usersRepo } from '../db/repositories/users.repo.js';
import { getParam } from '../utils/params.js';
import type { Request, Response } from 'express';

const router = Router();

router.use(isAuthenticated, isAdmin);

router.post('/', validate(createUserSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, full_name, role } = req.body;

    const existing = await usersRepo.findByEmail(email);
    if (existing) {
      res.status(409).json({ error: 'Email already exists', code: 'DUPLICATE_EMAIL' });
      return;
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = await usersRepo.create({ email, password_hash, full_name, role });
    res.status(201).json(user);
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const role = req.query.role as string | undefined;
    const is_active = req.query.is_active !== undefined
      ? req.query.is_active === 'true'
      : undefined;

    const result = await usersRepo.findAll({ role, is_active });
    res.json(result);
  } catch (err) {
    console.error('Error listing users:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', validateParams(uuidParamSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await usersRepo.findById(getParam(req, 'id'));
    if (!user) {
      res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
      return;
    }
    const { password_hash, ...safe } = user;
    res.json(safe);
  } catch (err) {
    console.error('Error getting user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', validateParams(uuidParamSchema), validate(updateUserSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await usersRepo.update(getParam(req, 'id'), req.body);
    if (!user) {
      res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(user);
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id/role', validateParams(uuidParamSchema), validate(updateUserRoleSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req, 'id');
    const { role } = req.body as { role: 'employee' };

    const user = await usersRepo.findById(id);
    if (!user) {
      res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
      return;
    }

    if (user.role === 'admin') {
      res.status(403).json({ error: 'Cannot change admin role', code: 'FORBIDDEN' });
      return;
    }

    if (user.role !== 'client') {
      res.status(400).json({ error: 'Only client users can be promoted', code: 'INVALID_ROLE_CHANGE' });
      return;
    }

    const updated = await usersRepo.updateRole(id, role);
    if (!updated) {
      res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
      return;
    }

    res.json(updated);
  } catch (err) {
    console.error('Error updating user role:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', validateParams(uuidParamSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await usersRepo.findById(getParam(req, 'id'));
    if (!user) {
      res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
      return;
    }
    if (user.role === 'admin') {
      res.status(403).json({ error: 'Cannot delete admin account', code: 'FORBIDDEN' });
      return;
    }

    await usersRepo.delete(getParam(req, 'id'));
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
