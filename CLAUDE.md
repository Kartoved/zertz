# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this project

Browser implementation of the ZERTZ board game (abstract strategy, GIPF Project). Supports local hot-seat, vs-bot, and online multiplayer modes. PWA-ready.

## Commands

```bash
# Development (run both concurrently in separate terminals)
npm run dev          # Vite dev server on port 5173 (proxies /api → localhost:5050)
npm run dev:server   # Express backend on port 5050

# Production build
npm run build        # tsc + vite build → dist/

# Start production server
npm start            # node server/server.js (serves dist/ as static files)

# Tests
npm run test         # Vitest (unit tests)
npm run test:watch   # Vitest in watch mode

# Local DB via Docker
docker compose up -d  # starts postgres on port 5432

# Deployment (Railway)
npm run railway:build
npm run railway:start
```

Environment: copy `.env.example` → `.env`, set `JWT_SECRET`. Backend connects to Postgres via `DATABASE_URL` or individual `PG*` env vars.

Unit tests live in `src/game/GameEngine.test.ts` (Vitest). Playwright is installed but e2e test files haven't been written.

## Architecture overview

### Frontend (`src/`)

**Game engine** (`src/game/`) — pure TypeScript, no React deps:
- `types.ts` — all core types (`GameState`, `Ring`, `Move`, `GameNode`, win conditions, reserves)
- `Board.ts` — hex board geometry: axial coordinates (q,r), neighbor lookup, free-ring detection, isolation detection, SVG pixel conversion
- `GameEngine.ts` — state machine: `placeMarble` → `removeRing` → `executeCapture` → win check; handles mandatory captures and isolation auto-capture
- `GameEngine.test.ts` — Vitest unit tests for the engine

**AI** (`src/ai/`) — bot opponent, runs in a Web Worker:
- `minimax.ts` — minimax with alpha-beta pruning
- `evaluate.ts` — position evaluation heuristic
- `worker.ts` — Web Worker wrapper (keeps UI responsive during search)

**State management** (`src/store/`) — Zustand:
- `gameStore.ts` — local game (IndexedDB persistence, game tree navigation, undo)
- `roomStore.ts` — online game (polls backend, syncs state/tree, manages clocks and chat)
- `authStore.ts` — JWT session (stored in localStorage)
- `uiStore.ts` — screen routing (`'menu' | 'game' | 'rules'`) and modal visibility

**DB/API layer** (`src/db/`):
- `apiClient.ts` — base fetch helpers + `serializeState`/`deserializeState` + `serializeTree`/`deserializeTree` (GameState ↔ JSON for API calls)
- `*Api.ts` files — thin wrappers around each backend route group
- `indexedDB.ts` + `gamesStorage.ts` — local game persistence

**Utilities** (`src/utils/`):
- `moveActions.ts` — shared move action helpers (used by gameStore and roomStore)
- `sounds.ts` — sound effect playback
- `country.ts` — country/locale utilities

**Other frontend files**:
- `pushNotifications.ts` — Web Push subscription management (client side)
- `version.ts` — app version constant
- `sw.js` — service worker (PWA caching)

**Localization** (`src/locales/`) — TypeScript objects, three languages: `ru`, `en`, `eo`.

### Backend (`server/`)

Express app with JWT auth middleware. All routes under `/api`, static `dist/` served with SPA fallback.

| Route prefix | File | Purpose |
|---|---|---|
| `/api/auth` | `routes/auth.js` | Register, login, magic-link passwordless auth, profile |
| `/api/rooms` | `routes/rooms.js` | Room CRUD, state sync, Glicko-2 rating update on finish |
| `/api/matchmake` | `routes/matchmaking.js` | In-memory queue, adaptive rating tolerance |
| `/api/challenges` | `routes/challenges.js` | Game invitations |
| `/api/players` | `routes/players.js` | Profiles, leaderboard, follows |
| `/api/games` | `routes/games.js` | Game history |
| `/api/global-chat` | `routes/chat.js` | Global chat |
| `/api/push` | `routes/push.js` | Web Push subscriptions (VAPID) |

`server/db.js` owns the PostgreSQL pool and creates all tables on startup (idempotent).

`server/utils/`:
- `glicko2.js` — standalone Glicko-2 rating implementation
- `mailer.js` — email sending (used for magic link auth)
- `pushNotifications.js` — server-side Web Push delivery

### Game rules summary (for engine work)

**Turn phases:** `placement` → `ringRemoval` → `capture` → back to `placement`

- **Mandatory captures**: if any capture exists, player must capture (no placement allowed)
- **Free ring**: empty ring with ≥2 adjacent free edges — eligible for removal
- **Isolation auto-capture**: removing a ring that disconnects a fully-filled group awards those marbles to the removing player
- **Win**: 4 white, 5 gray, 6 black, OR 3 of each color in captures

**Board sizes** (axial hex, flat-top): 37 rings (7 rows), 48 rings (8 rows), 61 rings (9 rows). Coordinates precomputed in `Board.ts`.

**Move notation**: `W b3` (placement), `Wb3 -c4` (placement + ring removal), `Wa4×c4×e5 +wg` (capture chain: marble color + start × each landing, suffix +colors of captured marbles). Column letters a–g left to right (by axial q), row numbers count from 1 at the bottom of each column. Implemented in `Board.ts:idToAlgebraic` and `GameEngine.ts:moveToNotation`.

**Online sync** uses polling (no WebSockets). Game state and move tree are serialized to JSON columns (`state_json`, `tree_json`) in the `rooms` table.
