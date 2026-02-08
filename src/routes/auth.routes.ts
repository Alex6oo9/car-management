import { Router } from 'express';
import passport from '../auth/passport.js';
import { isAuthenticated } from '../auth/middleware.js';
import { validate } from '../middleware/validate.js';
import { loginSchema } from '../validation/schemas.js';
import { loginRateLimit } from '../middleware/rateLimit.js';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

router.post('/login', loginRateLimit, validate(loginSchema), (req: Request, res: Response, next: NextFunction): void => {
  passport.authenticate('local', (err: Error | null, user: Express.User | false, info: { message: string }) => {
    if (err) return next(err);
    if (!user) {
      res.status(401).json({ error: info?.message || 'Invalid credentials' });
      return;
    }
    req.logIn(user, (loginErr) => {
      if (loginErr) return next(loginErr);
      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
        },
      });
    });
  })(req, res, next);
});

router.post('/logout', isAuthenticated, (req: Request, res: Response, next: NextFunction): void => {
  req.logout((err) => {
    if (err) return next(err);
    res.json({ message: 'Logout successful' });
  });
});

router.get('/me', isAuthenticated, (req: Request, res: Response): void => {
  const user = req.user!;
  res.json({
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    is_active: user.is_active,
  });
});

export default router;
