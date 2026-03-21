import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { authRequired, JWT_SECRET } from '../middleware/auth.js';

const router = Router();

const SPECIAL_CHARS = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/;

router.post('/register', async (req, res) => {
  const { username, password } = req.body;

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

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, quote, country, contact_link, rating, rating_rd, wins, losses, best_streak, current_streak, created_at`,
      [trimmedName, hash]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
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
      'SELECT id, username, quote, country, contact_link, rating, rating_rd, wins, losses, best_streak, current_streak, created_at FROM users WHERE id = $1',
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
  const { quote, country, contactLink, oldPassword, newPassword } = req.body;

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

    const result = await pool.query(
      'SELECT id, username, quote, country, contact_link, rating, rating_rd, wins, losses, best_streak, current_streak, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    const u = result.rows[0];
    res.json({
      id: u.id,
      username: u.username,
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

export default router;
