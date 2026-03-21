import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired, optionalAuth } from '../middleware/auth.js';

const router = Router();
const followsRouter = Router();

// ==================== PLAYERS ====================

router.get('/', async (req, res) => {
  const sortMap = {
    rating: 'rating',
    wins: 'wins',
    losses: 'losses',
    username: 'username',
    created_at: 'created_at',
    games: '(wins + losses)',
    winrate: 'CASE WHEN (wins + losses) > 0 THEN wins::float / (wins + losses) ELSE 0 END',
  };
  let sort = req.query.sort || 'rating';
  if (!Object.prototype.hasOwnProperty.call(sortMap, sort)) sort = 'rating';
  const order = req.query.order === 'asc' ? 'ASC' : 'DESC';
  const sortExpr = sortMap[sort];

  try {
    const result = await pool.query(
      `SELECT id, username, country, rating, wins, losses, best_streak, created_at
       FROM users ORDER BY ${sortExpr} ${order}, id ASC`
    );
    res.json(result.rows.map(u => ({
      id: u.id,
      username: u.username,
      country: u.country,
      rating: Math.round(u.rating),
      wins: u.wins,
      losses: u.losses,
      games: u.wins + u.losses,
      winrate: (u.wins + u.losses) > 0 ? Math.round(u.wins / (u.wins + u.losses) * 100) : 0,
      bestStreak: u.best_streak,
      createdAt: u.created_at.getTime(),
    })));
  } catch (err) {
    console.error('Players list error:', err);
    res.status(500).json({ error: 'Ошибка получения списка игроков' });
  }
});

// Get player profile by ID
router.get('/:id', optionalAuth, async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  try {
    const result = await pool.query(
      'SELECT id, username, quote, country, contact_link, rating, rating_rd, wins, losses, best_streak, current_streak, created_at FROM users WHERE id = $1',
      [userId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Игрок не найден' });
      return;
    }
    const u = result.rows[0];
    const data = {
      id: u.id,
      username: u.username,
      quote: u.quote,
      country: u.country,
      contactLink: u.contact_link,
      rating: Math.round(u.rating),
      ratingRd: u.rating_rd,
      wins: u.wins,
      losses: u.losses,
      games: u.wins + u.losses,
      winrate: (u.wins + u.losses) > 0 ? Math.round(u.wins / (u.wins + u.losses) * 100) : 0,
      bestStreak: u.best_streak,
      currentStreak: u.current_streak,
      createdAt: u.created_at.getTime(),
      isFollowing: false,
    };

    // Check if current user follows this player
    if (req.user) {
      const followCheck = await pool.query(
        'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2',
        [req.user.id, userId]
      );
      data.isFollowing = followCheck.rows.length > 0;
    }

    res.json(data);
  } catch (err) {
    console.error('Get player error:', err);
    res.status(500).json({ error: 'Ошибка получения профиля игрока' });
  }
});

// ==================== FOLLOWS ====================

followsRouter.post('/:userId', authRequired, async (req, res) => {
  const targetId = parseInt(req.params.userId, 10);
  if (targetId === req.user.id) {
    res.status(400).json({ error: 'Нельзя подписаться на себя' });
    return;
  }
  try {
    await pool.query(
      'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user.id, targetId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Follow error:', err);
    res.status(500).json({ error: 'Ошибка подписки' });
  }
});

followsRouter.delete('/:userId', authRequired, async (req, res) => {
  const targetId = parseInt(req.params.userId, 10);
  try {
    await pool.query('DELETE FROM follows WHERE follower_id = $1 AND following_id = $2', [req.user.id, targetId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Unfollow error:', err);
    res.status(500).json({ error: 'Ошибка отписки' });
  }
});

followsRouter.get('/', authRequired, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.country, u.rating, u.wins, u.losses, u.best_streak, u.created_at
       FROM follows f JOIN users u ON u.id = f.following_id
       WHERE f.follower_id = $1
       ORDER BY u.rating DESC`,
      [req.user.id]
    );
    res.json(result.rows.map(u => ({
      id: u.id,
      username: u.username,
      country: u.country,
      rating: Math.round(u.rating),
      wins: u.wins,
      losses: u.losses,
      games: u.wins + u.losses,
      winrate: (u.wins + u.losses) > 0 ? Math.round(u.wins / (u.wins + u.losses) * 100) : 0,
      bestStreak: u.best_streak,
      createdAt: u.created_at.getTime(),
    })));
  } catch (err) {
    console.error('Get follows error:', err);
    res.status(500).json({ error: 'Ошибка получения подписок' });
  }
});

// Get list of user IDs the current user follows (for quick lookup)
followsRouter.get('/ids', authRequired, async (req, res) => {
  try {
    const result = await pool.query('SELECT following_id FROM follows WHERE follower_id = $1', [req.user.id]);
    res.json(result.rows.map(r => r.following_id));
  } catch (err) {
    console.error('Get follow ids error:', err);
    res.status(500).json({ error: 'Ошибка' });
  }
});

export default router;
export { followsRouter };
