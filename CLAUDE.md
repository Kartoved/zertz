# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this project

Browser implementation of the ZERTZ board game (abstract strategy, GIPF Project). Supports local hot-seat, online multiplayer, and lobby modes. PWA-ready. Bot (vs-AI) mode is present in the codebase but disabled in the UI (marked "coming soon").

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
docker compose up -d db   # postgres on 5432 (db service only — see note below)
```

`docker-compose.yml` defines **two** services: `db` (postgres) and `web` (the full app image). For local development run only `db` in Docker, plus `npm run dev` (Vite) + `npm run dev:server` (Express on 5050); the `web` image is for production and, if left running locally, squats port 5050 with a possibly-stale build. The Vite dev proxy forwards `/api` → `127.0.0.1:5050`.

**Deployment: Docker Compose on a VDS.** Production now runs `docker compose up -d` (both `web` + `db`) on a self-hosted VDS — no longer Railway. Containers default to UTC (no `TZ` set), which the clock logic relies on (see the timestamp convention below). The `railway:*` package scripts are legacy.

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
- `lobbyStore.ts` — lobby slots (polls `/api/lobby` every 5s, create/join/cancel slot)

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

**News / blog** (`src/blog/`, `src/components/Blog/`, `blog/`):
- Posts live as Markdown files in `blog/*.md` at project root. Frontmatter is YAML-lite (slug, date, tags, version, title.{ru,en,eo}, pinned, announce, cover); body is split into per-locale sections by `# ru` / `# en` / `# eo` headings.
- `src/blog/parse.ts` parses one file; `loader.ts` uses Vite `import.meta.glob('/blog/*.md', { query: '?raw', eager: true })` to bundle every post at build time. No runtime fetch.
- UI is reached via the top-level **NEWS** nav button (route `/news`, post detail `/news/:slug`). Labels in `src/locales/*.ts` use `t.blog` (= "News" / "Новости" / "Novaĵoj"); the URL deliberately matches the label, the on-disk folder is named `blog/` for historical reasons.
- Rendering uses `react-markdown` + Tailwind Typography (`prose` classes).
- WhatsNewModal still keeps its own TS array for legacy changelog auto-show on version bump — not migrated to MD yet.

**Localization** (`src/locales/`) — TypeScript objects, three languages: `ru`, `en`, `eo`.

### Shared (`shared/`)

Plain-JS ESM modules consumed by **both** the Vite client and the Node server. Used for code that must produce byte-identical output on both sides (the opening-explorer pipeline depends on this).

- `shared/explorer/` — opening-explorer canonicalization & indexing:
  - `axial.js` — hex coordinate transforms (12 D6 symmetries), per-board valid-symmetry detection, inverse table.
  - `replay.js` — minimal ZERTZ state-replay engine. **Mirror of `src/game/GameEngine.ts`** for the subset needed to compute boundary positions (placeMarble, removeRing+isolation, executeCapture, applyMove). Doesn't validate moves — trusts game-tree data.
  - `canonicalize.js` — picks a canonical state representative across all valid symmetries; canonicalizes & decanonicalizes moves so equivalent (state, move) pairs collapse to the same hash.
  - `hash.js` — 64-bit FNV-1a hash, returned as 16-char hex (works in Node and browser, no `node:crypto`).
  - `indexer.js` — walks a game tree's main line, yields `{positionHash, ply, move, moveNotation}` per node.
  - `*.test.js` / `parity.test.ts` — guards against drift between TS engine and JS replay; `parity.test.ts` runs the same Move sequences through both engines and asserts state equality.
  - `*.d.ts` — ambient declarations so TypeScript clients can import without `allowJs`.

If you change `src/game/GameEngine.ts`, mirror the change into `shared/explorer/replay.js`. The parity test will catch divergence.

### Backend (`server/`)

Express app with JWT auth middleware. All routes under `/api`, static `dist/` served with SPA fallback.

| Route prefix | File | Purpose |
|---|---|---|
| `/api/auth` | `routes/auth.js` | Register, login, magic-link passwordless auth, profile |
| `/api/rooms` | `routes/rooms.js` | Room CRUD, state sync, Glicko-2 rating update on finish, `POST /:id/add-time` (gift time to opponent's clock) |
| `/api/matchmake` | `routes/matchmaking.js` | In-memory queue, adaptive rating tolerance |
| `/api/challenges` | `routes/challenges.js` | Game invitations |
| `/api/players` | `routes/players.js` | Profiles, leaderboard, follows |
| `/api/games` | `routes/games.js` | Game history |
| `/api/global-chat` | `routes/chat.js` | Global chat |
| `/api/push` | `routes/push.js` | Web Push subscriptions (VAPID) |
| `/api/lobby` | `routes/lobby.js` | Public lobby slots (create/join/cancel, 10-min TTL) |
| `/api/explorer` | `routes/explorer.js` | Opening-explorer position lookup (aggregates + per-game refs) |
| `/api/studies` | `routes/studies.js` | Studies (Lichess-style lessons): Notion-like hierarchy CRUD, public list, per-`:owner/:slug` fetch, move/reorder, deep clone |

`server/db.js` owns the PostgreSQL pool and creates all tables on startup (idempotent). Tables include `position_moves` (per-position move aggregates) and `position_games` (per-game references); see `shared/explorer/` for the indexing pipeline.

`server/explorer.js` indexes a finished room into both tables when the rooms route sets a winner; idempotent via `rooms.explorer_indexed_at`. One-shot backfill: `node server/scripts/backfillExplorer.js`.

`server/utils/`:
- `glicko2.js` — standalone Glicko-2 rating implementation
- `mailer.js` — email sending (used for magic link auth)
- `pushNotifications.js` — server-side Web Push delivery

`server/scripts/`:
- `backfillExplorer.js` — one-shot indexer for finished games into `position_moves` / `position_games`
- `announceBlog.js` — pushes blog posts into global chat as system messages from the username **"Zertz System"** (`user_id = NULL`, body `[BLOG_POST]<slug>|<title>`). Idempotent via the `blog_announced` table (slug PK). Run as `npm run blog:announce`; flags: `--slug=X` (force one post), `--dry-run`, `--list`. The `tryRenderSystemBody()` helper in `src/components/UI/SystemMessageCard.tsx` recognises the `[BLOG_POST]...` body and renders a clickable amber card linking to `/news/<slug>`.

### Conventions worth remembering

**Rated by default.** All paths that create a multiplayer room (`/api/rooms`, `/api/challenges`, `OnlineChallengeModal`, `PlayerProfileModal`'s invite, lobby slots, matchmaking) default to `rated = true`. Unrated is an explicit opt-out for experiments/training. The profile stats block (`games`, `wins`, `losses`, `winrate`, `bestStreak`) is sourced from `users.wins`/`users.losses` and reflects **rated games only** — the UI labels it «Rated stats» / «Рейтинговая статистика». The full history list (`PlayerGamesModal`, `LoadGameModal`) shows all games with a `rated`/`unrated` badge per row.

**`state.moveNumber` starts at 1.** The initial `GameState` has `moveNumber: 1`; it increments after every move. So after N completed moves, `moveNumber === N + 1`. Code that *counts* moves for display should subtract 1; code that uses the parity to determine whose turn it is should use `moveNumber` as-is. This is the recurring off-by-one trap.

**Mobile game screens use compact strips.** Both `RoomScreen` (online) and `GameScreen` (local) hide their desktop side panels on `<lg` and render: move-history strip under the header → opponent/player1 strip → board (flex-1) → you/player2 strip + ⋯ menu → marble picker (only during placement). Action buttons (Undo, Resign, Analysis, Cancel) live in a bottom-sheet popover triggered by the ⋯ icon in the bottom strip. Pre-moves are rendered in a separate "Plan" tab in the right sidebar / bottom nav, visible only for correspondence participants in analysis mode.

**Conditional pre-moves are a TREE rooted at the live position (correspondence games only).** Model in `src/game/types.ts` (`PreMoveNode` with `children`, `PreMoveTree`, `PreMovesByPlayer`, `PreMoveNotice`). Invariant: opponent-move nodes may have many children (branch per opponent reply); my-move nodes have exactly one (from one position I play one move). The plan is built in **analysis mode** — you play variations on the board (they become branches in the analysis game tree), then **"Arm plan from analysis"** (`roomStore.armAnalysisSubtree` → `premovesActions.analysisSubtreeToTree`) snapshots the analysis subtree **rooted at the current live position** into `premoves_json`. Because the root is the live position (computed via `mainLineNodeAtDepth`/`nodeDepth`), already-played moves drop out of the plan automatically. If my own move leads the plan, arming plays it live first (reusing the interactive handlers) then arms the rest. Server auto-fires on the opponent's real move: `server/utils/premoveTree.js` `selectPremoveResponse` picks the branch, `server/utils/verifyState.js` `computePremoveResponse` validates + applies it server-authoritatively (never trusts client state), then the tree shifts down (played branch becomes root, off-track siblings pruned) with a client-facing `notice` (fired/pruned toast). Legacy flat-array `premoves_json` is migrated on read (`premoveTree.parsePremoves`). The top move-history strip (`OnlineMoveHistory`) shows only the **linear current line** — all branching lives in the Plan-tab vertical tree (`RoomScreen`, navigable, `deleteAnalysisBranch` to prune). If you touch the auto-fire/selection logic, keep `server/utils/premoveTree.test.js` green.

**All `TIMESTAMP` columns are UTC; `server/db.js` forces node-postgres to parse them as UTC.** The tables use `timestamp without time zone`, every write uses SQL `NOW()`, and the DB session runs in UTC. By default node-postgres parses a bare timestamp in the **Node process's local timezone**, so on a non-UTC host `new Date(row.clock_running_since).getTime()` is off by the UTC offset — which made timed games instantly flag-fall on a dev machine at UTC+3. `server/db.js` sets `types.setTypeParser(1114, …)` to read these as UTC. Never compare a raw pg timestamp against `Date.now()` without that in place; prod containers run UTC so it was previously masked. Clock math lives in `server/routes/rooms.js` (read-time flag-fall in `GET /:id`, per-move deduction in `PUT /:id/state`).

**Top-level `ErrorBoundary` (`src/components/UI/ErrorBoundary.tsx`).** Wraps the router in `App.tsx` so a render-time throw shows a recoverable fallback (with the stack in a `<details>`) instead of a blank white screen. Note it only catches render/lifecycle errors, not event-handler errors.

**Board previews reuse `HexBoard` in `preview` mode.** `MiniGamePreview` renders `<HexBoard state=… preview />` — a static, non-interactive fit-to-container variant (no zoom/pan, tighter padding). Gradient ids in `HexRing` are prefixed with a per-`HexBoard` `useId()` so multiple boards on one page (e.g. the menu's current-games grid) don't collide on duplicate `url(#…)` refs and render transparent. The desktop main-menu center shows current games as a wrapping grid of these previews (your-turn games first, green border), inside the same card as the Rooms/Ladder panel.

**Studies (Lichess-style lessons) live under `src/components/Studies/` + `src/store/studyStore.ts`.** Route `/studies` and `/studies/:owner/:slug` (`App.tsx`), reached from the **Learning** menu. Data model is one `studies` table (`server/db.js`) where **every row is both content AND a Notion-like nestable node** (`parent_id`, fractional `sort`); `setup_json` is the starting `GameState`, `tree_json` is a `GameNode` tree (with an optional `comment` on nodes), plus `root_comment`/`meta_json`/`is_public`. `slug` is a user-editable, per-owner-unique, transliterated handle (`server/utils/slug.js`). The board interaction **reuses the pure `analysisActions` helpers** (placement/ring-removal/capture) — reader moves branch into a LOCAL working tree and are never persisted; the author's edits **autosave** (debounced, owner-only, skipped mid-`ringRemoval`) via `studyStore.saveStudyTree` → `PUT /:id`. Position reconstruction uses `studyStateAtNode` (replays from `setup_json`, NOT `createInitialState`, then `normalizePhase`) — so a study may start from a custom position. The arbitrary-position editor (`PositionEditorModal`) conserves the marble supply (6/8/10) by construction and uses `HexBoard editable` (removed rings render as clickable ghost slots). `SaveToStudy` (mounted in `RoomScreen`) turns any live/analysis position into a new study. **Board annotations** (Lichess-style right-click arrows/circles) live on `GameNode.shapes?: Shape[]` (`{orig,dest?,brush}`; 4 colors via Shift/Alt/Ctrl); `HexBoard`'s `drawable`/`shapes`/`onShapeDraw` props handle rendering + right-drag drawing with a live preview (cursor→SVG coords via `getScreenCTM().inverse()`), studies+desktop only. If you touch the interaction, note it is the SAME code path as online analysis. Full build history: `docs/STUDIES_PLAN.md`.

### Game rules summary (for engine work)

**Turn phases:** `placement` → `ringRemoval` → `capture` → back to `placement`

- **Mandatory captures**: if any capture exists, player must capture (no placement allowed)
- **Free ring**: empty ring with ≥2 adjacent free edges — eligible for removal
- **Isolation auto-capture**: after a ring removal, **every** fully-occupied isolated group is captured by the removing player (play continues on whichever group still has an empty ring). This includes the case where the split leaves *all* remaining marbles in one filled group — those are captured and can trigger the win. Mirrored in `shared/explorer/replay.js` (`handleIsolation`).
- **Win**: 4 white, 5 gray, 6 black, OR 3 of each color in captures

**Board sizes** (axial hex, flat-top): 37 rings (7 rows), 48 rings (8 rows), 61 rings (9 rows). Coordinates precomputed in `Board.ts`.

**Move notation**: `W b3` (placement), `Wb3 -c4` (placement + ring removal), `Wa4×c4×e5 +wg` (capture chain: marble color + start × each landing, suffix +colors of captured marbles). Column letters a–g left to right (by axial q), row numbers count from 1 at the bottom of each column. Implemented in `Board.ts:idToAlgebraic` and `GameEngine.ts:moveToNotation`.

**Online sync** uses polling (no WebSockets). Game state and move tree are serialized to JSON columns (`state_json`, `tree_json`) in the `rooms` table.
