import { Router } from 'express';
import bcrypt from 'bcrypt';
import passport from '../auth/passport.js';
import { isAuthenticated } from '../auth/middleware.js';
import { validate } from '../middleware/validate.js';
import {loginSchema,registerSchema,resendVerificationSchema,forgotPasswordSchema,resetPasswordSchema,} from '../validation/schemas.js';
import { loginRateLimit, registerRateLimit, forgotPasswordRateLimit, resendVerificationRateLimit } from '../middleware/rateLimit.js';
import type { Request, Response, NextFunction } from 'express';
import { pool } from '../db/pool.js';
import { generateToken, hashToken } from '../utils/tokens.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email.js';
import { env } from '../config/env.js';


const isGuest = (req: Request, res: Response, next: NextFunction): void => {
  if (req.isAuthenticated()) {
    res.status(400).json({ error: 'Already authenticated' });
    return;
  }
  next();
};


const router = Router();

router.post('/register', registerRateLimit, validate(registerSchema), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password, full_name } = req.body;

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, is_active, is_email_verified)
       VALUES ($1, $2, $3, 'client', true, false)
       RETURNING id`,
      [email, passwordHash, full_name]
    );

    const userId = userResult.rows[0].id as string;

    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt]
    );

    sendVerificationEmail(email, full_name, token).catch(console.error);

    res.status(201).json({
      message: 'Account created. Please check your email to verify your account.',
    });
  } catch (err) {
    next(err);
  }
});

router.get('/verify-email', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token : undefined;
    if (!token) {
      res.status(400).json({ error: 'Token is required' });
      return;
    }

    const tokenHash = hashToken(token);

    const result = await pool.query(
      `SELECT user_id, expires_at
       FROM email_verification_tokens
       WHERE token_hash = $1`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      res.status(400).json({ error: 'Invalid or expired verification link' });
      return;
    }

    const { user_id, expires_at } = result.rows[0] as { user_id: string; expires_at: string };
     if (new Date(expires_at) < new Date()) {
     await pool.query('DELETE FROM email_verification_tokens WHERE token_hash = $1', [tokenHash]);
     res.status(400).json({ error: 'Invalid or expired verification link' });
     return;
}

    await pool.query(
      `UPDATE users
       SET is_email_verified = TRUE
       WHERE id = $1`,
      [user_id]
    );

    await pool.query(
      `DELETE FROM email_verification_tokens
       WHERE user_id = $1`,
      [user_id]
    );

    res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (err) {
    next(err);
  }
});

router.post('/resend-verification',resendVerificationRateLimit, validate(resendVerificationSchema), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;

    const genericMsg = 'If an account exists for this email, a verification link has been sent.';

    const userResult = await pool.query(
      `SELECT id, full_name, is_email_verified
       FROM users
       WHERE email = $1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      res.json({ message: genericMsg });
      return;
    }

    const user = userResult.rows[0] as { id: string; full_name: string; is_email_verified: boolean };

    if (user.is_email_verified) {
      res.json({ message: genericMsg });
      return;
    }

    await pool.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [user.id]);

    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    sendVerificationEmail(email, user.full_name, token).catch(console.error);

    res.json({ message: genericMsg });
  } catch (err) {
    next(err);
  }
});

router.post('/forgot-password', forgotPasswordRateLimit,validate(forgotPasswordSchema), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;

    // Always respond the same (prevents email enumeration)
    const genericMsg = "If an account exists for this email, you'll receive a password reset link shortly.";

    const userResult = await pool.query(
      `SELECT id, full_name
       FROM users
       WHERE email = $1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      res.json({ message: genericMsg });
      return;
    }

    const user = userResult.rows[0] as { id: string; full_name: string };

    // Invalidate any existing unused tokens
    await pool.query(
      'DELETE FROM password_reset_tokens WHERE user_id = $1 AND used = FALSE',
      [user.id]
    );

    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, used)
       VALUES ($1, $2, $3, FALSE)`,
      [user.id, tokenHash, expiresAt]
    );

    sendPasswordResetEmail(email, user.full_name, token).catch(console.error);

    res.json({ message: genericMsg });
  } catch (err) {
    next(err);
  }
});
router.post('/reset-password', validate(resetPasswordSchema), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token, new_password } = req.body;

    const tokenHash = hashToken(token);

    const tokenResult = await pool.query(
      `SELECT id, user_id, expires_at, used
       FROM password_reset_tokens
       WHERE token_hash = $1`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      res.status(400).json({ error: 'Invalid or expired reset link' });
      return;
    }

    const row = tokenResult.rows[0] as { id: string; user_id: string; expires_at: string; used: boolean };

    if (row.used) {
      res.status(400).json({ error: 'Invalid or expired reset link' });
      return;
    }
    
    if (new Date(row.expires_at) < new Date()) {
      await pool.query('DELETE FROM password_reset_tokens WHERE id = $1', [row.id]);
      res.status(400).json({ error: 'Invalid or expired reset link' });
      return;
    }
    const newHash = await bcrypt.hash(new_password, 10);

    await pool.query(
      `UPDATE users
       SET password_hash = $1,
           is_email_verified = TRUE
       WHERE id = $2`,
      [newHash, row.user_id]
    );

    await pool.query(
      `UPDATE password_reset_tokens
       SET used = TRUE
       WHERE id = $1`,
      [row.id]
    );
   
    await pool.query(
      `DELETE FROM "session"
       WHERE sess->'passport'->>'user' = $1`,
      [row.user_id]
    );

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    next(err);
  }
});

router.get(
  '/google',
  isGuest,
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${env.APP_URL}/login`,
    session: true,
  }),
  (req: Request, res: Response) => {
    res.redirect(env.APP_URL);
  }
);

router.post('/login', loginRateLimit, validate(loginSchema), (req: Request, res: Response, next: NextFunction): void => {
  passport.authenticate('local', (err: Error | null, user: Express.User | false, info: { message: string }) => {
    if (err) return next(err);
    if (!user) {
      res.status(401).json({ error: info?.message || 'Invalid credentials' });
      return;
    }
    if (!user.is_email_verified) {
      res.status(403).json({
        error: 'Please verify your email before logging in.',
        email: user.email,
      });
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
