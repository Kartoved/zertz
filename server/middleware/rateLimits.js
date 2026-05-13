import { rateLimit } from 'express-rate-limit';

// Brute-force protection for login / register / magic-link.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please try again later' },
});

// Chat flood protection (global chat + room chat).
export const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много сообщений, подождите немного' },
});

// Move submission limiter — generous for fast blitz games.
export const moveLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many move submissions' },
});

// Room / lobby creation limiter.
export const createRoomLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many rooms created, please wait' },
});
