import { Router } from 'express';
import { isAuthenticated, isAdminOrEmployee } from '../auth/middleware.js';
import { validate, validateParams } from '../middleware/validate.js';
import { createCustomerSchema, updateCustomerSchema, uuidParamSchema } from '../validation/schemas.js';
import { customersRepo } from '../db/repositories/customers.repo.js';
import { getParam } from '../utils/params.js';
import type { Request, Response } from 'express';

const router = Router();

router.use(isAuthenticated, isAdminOrEmployee);

router.post('/', validate(createCustomerSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const customer = await customersRepo.create(req.body);
    res.status(201).json(customer);
  } catch (err) {
    console.error('Error creating customer:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const search = req.query.search as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;

    const result = await customersRepo.findAll({ search, limit, offset });
    res.json(result);
  } catch (err) {
    console.error('Error listing customers:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', validateParams(uuidParamSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const customer = await customersRepo.findById(getParam(req, 'id'));
    if (!customer) {
      res.status(404).json({ error: 'Customer not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(customer);
  } catch (err) {
    console.error('Error getting customer:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', validateParams(uuidParamSchema), validate(updateCustomerSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const customer = await customersRepo.update(getParam(req, 'id'), req.body);
    if (!customer) {
      res.status(404).json({ error: 'Customer not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(customer);
  } catch (err) {
    console.error('Error updating customer:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
