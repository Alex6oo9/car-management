import { Router } from 'express';
import { isAuthenticated, isAdminOrEmployee } from '../auth/middleware.js';
import { validate, validateParams } from '../middleware/validate.js';
import { updateFeedbackStatusSchema, uuidParamSchema } from '../validation/schemas.js';
import { feedbackRepo } from '../db/repositories/feedback.repo.js';
import { getParam } from '../utils/params.js';
import type { Request, Response } from 'express';

const router = Router();

router.use(isAuthenticated, isAdminOrEmployee);

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const is_approved =
      req.query.is_approved === 'true' ? true :
      req.query.is_approved === 'false' ? false :
      undefined;

    const feedback = await feedbackRepo.findAll({ is_approved });
    res.json(feedback);
  } catch (err) {
    console.error('Error listing feedback:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', validateParams(uuidParamSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const feedback = await feedbackRepo.findById(getParam(req, 'id'));
    if (!feedback) {
      res.status(404).json({ error: 'Feedback not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(feedback);
  } catch (err) {
    console.error('Error getting feedback:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id/status', validateParams(uuidParamSchema), validate(updateFeedbackStatusSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const feedback = await feedbackRepo.setApproved(getParam(req, 'id'), req.body.is_approved);
    if (!feedback) {
      res.status(404).json({ error: 'Feedback not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(feedback);
  } catch (err) {
    console.error('Error updating feedback status:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', validateParams(uuidParamSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await feedbackRepo.delete(getParam(req, 'id'));
    if (!result.success) {
      res.status(404).json({ error: 'Feedback not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ message: 'Feedback deleted successfully' });
  } catch (err) {
    console.error('Error deleting feedback:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
