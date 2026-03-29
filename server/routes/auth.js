import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../db.js';
import { authRequired, JWT_SECRET } from '../middleware/auth.js';
import { sendEmail } from '../utils/mailer.js';

const router = Router();

const SPECIAL_CHARS = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/;

router.post('/register', async (req, res) => {
  const { username, password, email } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'Укажите ник и пароль' });
    return;
  }

  const trimmedName = username.trim();
  if (trimmedName.length < 2 || trimmedName.length > 24) {
    res.status(400).json({ error: 'Ник должен быть от 2 до 24 символов' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Пароль должен быть не менее 8 символов' });
    return;
  }

  if (!SPECIAL_CHARS.test(password)) {
    res.status(400).json({ error: 'Пароль должен содержать хотя бы один спецсимвол' });
    return;
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [trimmedName]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Ник уже занят' });
      return;
    }

    const emailValue = email ? email.toLowerCase().trim() : null;
    if (emailValue) {
      const emailExists = await pool.query('SELECT id FROM users WHERE email = $1', [emailValue]);
      if (emailExists.rows.length > 0) {
        res.status(409).json({ error: 'Этот email уже используется' });
        return;
      }
    }

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, email) VALUES ($1, $2, $3) RETURNING id, username, email, quote, country, contact_link, rating, rating_rd, wins, losses, best_streak, current_streak, created_at`,
      [trimmedName, hash, emailValue]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email || null,
        quote: user.quote,
        country: user.country,
        contactLink: user.contact_link,
        rating: user.rating,
        ratingRd: user.rating_rd,
        wins: user.wins,
        losses: user.losses,
        bestStreak: user.best_streak,
        currentStreak: user.current_streak,
        createdAt: user.created_at.getTime(),
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Ошибка регистрации' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'Укажите ник и пароль' });
    return;
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [username.trim()]);
    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Неверный ник или пароль' });
      return;
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Неверный ник или пароль' });
      return;
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email || null,
        quote: user.quote,
        country: user.country,
        contactLink: user.contact_link,
        rating: user.rating,
        ratingRd: user.rating_rd,
        wins: user.wins,
        losses: user.losses,
        bestStreak: user.best_streak,
        currentStreak: user.current_streak,
        createdAt: user.created_at.getTime(),
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Ошибка входа' });
  }
});

router.get('/me', authRequired, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, quote, country, contact_link, rating, rating_rd, wins, losses, best_streak, current_streak, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }
    const u = result.rows[0];
    res.json({
      id: u.id,
      username: u.username,
      email: u.email || null,
      quote: u.quote,
      country: u.country,
      contactLink: u.contact_link,
      rating: u.rating,
      ratingRd: u.rating_rd,
      wins: u.wins,
      losses: u.losses,
      bestStreak: u.best_streak,
      currentStreak: u.current_streak,
      createdAt: u.created_at.getTime(),
    });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Ошибка получения профиля' });
  }
});

router.put('/profile', authRequired, async (req, res) => {
  const { quote, country, contactLink, email, oldPassword, newPassword } = req.body;

  try {
    if (newPassword !== undefined) {
      if (!oldPassword) {
        res.status(400).json({ error: 'Укажите текущий пароль' });
        return;
      }
      if (newPassword.length < 8) {
        res.status(400).json({ error: 'Новый пароль должен быть не менее 8 символов' });
        return;
      }
      if (!SPECIAL_CHARS.test(newPassword)) {
        res.status(400).json({ error: 'Новый пароль должен содержать хотя бы один спецсимвол' });
        return;
      }
      const userRow = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
      const valid = await bcrypt.compare(oldPassword, userRow.rows[0].password_hash);
      if (!valid) {
        res.status(401).json({ error: 'Неверный текущий пароль' });
        return;
      }
      const hash = await bcrypt.hash(newPassword, 12);
      await pool.query('UPDATE users SET password_hash = $2 WHERE id = $1', [req.user.id, hash]);
    }

    if (quote !== undefined) {
      await pool.query('UPDATE users SET quote = $2 WHERE id = $1', [req.user.id, quote.slice(0, 200)]);
    }
    if (country !== undefined) {
      await pool.query('UPDATE users SET country = $2 WHERE id = $1', [req.user.id, country.slice(0, 10)]);
    }
    if (contactLink !== undefined) {
      await pool.query('UPDATE users SET contact_link = $2 WHERE id = $1', [req.user.id, String(contactLink).slice(0, 300)]);
    }
    if (email !== undefined) {
      const emailValue = email ? email.toLowerCase().trim() : null;
      if (emailValue) {
        const emailExists = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [emailValue, req.user.id]);
        if (emailExists.rows.length > 0) {
          res.status(409).json({ error: 'Этот email уже используется' });
          return;
        }
      }
      await pool.query('UPDATE users SET email = $2 WHERE id = $1', [req.user.id, emailValue]);
    }

    const result = await pool.query(
      'SELECT id, username, email, quote, country, contact_link, rating, rating_rd, wins, losses, best_streak, current_streak, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    const u = result.rows[0];
    res.json({
      id: u.id,
      username: u.username,
      email: u.email || null,
      quote: u.quote,
      country: u.country,
      contactLink: u.contact_link,
      rating: u.rating,
      ratingRd: u.rating_rd,
      wins: u.wins,
      losses: u.losses,
      bestStreak: u.best_streak,
      currentStreak: u.current_streak,
      createdAt: u.created_at.getTime(),
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Ошибка обновления профиля' });
  }
});

// POST /api/auth/magic-link/request — send magic link to email
router.post('/magic-link/request', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ error: 'Укажите email' });
    return;
  }

  const emailLower = email.toLowerCase().trim();

  try {
    const result = await pool.query(
      'SELECT id, username FROM users WHERE email = $1',
      [emailLower]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Аккаунт с таким email не найден' });
      return;
    }

    const user = result.rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate previous tokens for this user
    await pool.query('DELETE FROM magic_tokens WHERE user_id = $1', [user.id]);
    await pool.query(
      'INSERT INTO magic_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    const appUrl = process.env.APP_URL || 'http://localhost:5050';
    const link = `${appUrl}/magic?token=${token}`;

    await sendEmail({
      to: emailLower,
      subject: 'Вход в Zertz',
      html: `
        <p>Привет, ${user.username}!</p>
        <p>Нажмите ссылку для входа (действует 1 час):</p>
        <p><a href="${link}" style="font-size:16px;padding:10px 20px;background:#3b82f6;color:white;border-radius:8px;text-decoration:none;">Войти в Zertz</a></p>
        <p style="color:#888;font-size:12px;">Если вы не запрашивали вход — просто проигнорируйте это письмо.</p>
      `,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('Magic link request error:', err);
    res.status(500).json({ error: 'Ошибка отправки ссылки' });
  }
});

// GET /api/auth/magic-link/verify/:token — verify token and return JWT
router.get('/magic-link/verify/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const result = await pool.query(
      `SELECT mt.user_id, u.id, u.username, u.email, u.quote, u.country, u.contact_link,
              u.rating, u.rating_rd, u.wins, u.losses, u.best_streak, u.current_streak, u.created_at
       FROM magic_tokens mt
       JOIN users u ON u.id = mt.user_id
       WHERE mt.token = $1 AND mt.expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      res.status(400).json({ error: 'Ссылка недействительна или истекла' });
      return;
    }

    const u = result.rows[0];

    // Invalidate used token and clean up expired tokens
    await pool.query('DELETE FROM magic_tokens WHERE token = $1 OR expires_at <= NOW()', [token]);

    const jwtToken = jwt.sign({ id: u.id, username: u.username }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      token: jwtToken,
      user: {
        id: u.id,
        username: u.username,
        email: u.email || null,
        quote: u.quote,
        country: u.country,
        contactLink: u.contact_link,
        rating: u.rating,
        ratingRd: u.rating_rd,
        wins: u.wins,
        losses: u.losses,
        bestStreak: u.best_streak,
        currentStreak: u.current_streak,
        createdAt: u.created_at.getTime(),
      },
    });
  } catch (err) {
    console.error('Magic link verify error:', err);
    res.status(500).json({ error: 'Ошибка верификации ссылки' });
  }
});

export default router;
