import rateLimit from 'express-rate-limit';

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many login attempts, please try again later', code: 'RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const registerRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many registration attempts, please try again later', code: 'RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const forgotPasswordRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  message: { error: 'Too many password reset requests, please try again later', code: 'RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const resendVerificationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  message: { error: 'Too many verification resend requests, please try again later', code: 'RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false,
});
