import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { feedbackRateLimit } from '../middleware/rateLimit.js';
import { createFeedbackSchema } from '../validation/schemas.js';
import { feedbackRepo } from '../db/repositories/feedback.repo.js';
import type { Request, Response } from 'express';

const router = Router();

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;
    const result = await feedbackRepo.findPublic({ limit, offset });
    res.json(result);
  } catch (err) {
    console.error('Error listing public feedback:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', feedbackRateLimit, validate(createFeedbackSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const name = req.body.name || 'Anonymous';
    const feedback = await feedbackRepo.create({
      stars: req.body.stars,
      message: req.body.message,
      name,
    });
    res.status(201).json({ message: 'Thank you for your feedback', id: feedback.id });
  } catch (err) {
    console.error('Error creating feedback:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
