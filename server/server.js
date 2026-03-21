import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { ensureSchema } from './db.js';
import authRouter from './routes/auth.js';
import playersRouter, { followsRouter } from './routes/players.js';
import challengesRouter from './routes/challenges.js';
import matchmakingRouter from './routes/matchmaking.js';
import roomsRouter from './routes/rooms.js';
import chatRouter from './routes/chat.js';
import gamesRouter from './routes/games.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5050;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Health check
app.get('/api/health', async (_req, res) => {
  res.json({ ok: true });
});

// Mount route modules
app.use('/api/auth', authRouter);
app.use('/api/players', playersRouter);
app.use('/api/follows', followsRouter);
app.use('/api/challenges', challengesRouter);
app.use('/api/matchmake', matchmakingRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/global-chat', chatRouter);
app.use('/api/games', gamesRouter);

// Serve static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '..', 'dist');

app.use(express.static(distPath));
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const startServer = async () => {
  try {
    await ensureSchema();
    console.log('Postgres connected.');
  } catch (err) {
    console.error('Postgres unavailable, running without API persistence.');
  }

  app.listen(port, () => {
    console.log(`ZERTZ server running at http://localhost:${port}`);
  });
};

startServer();
