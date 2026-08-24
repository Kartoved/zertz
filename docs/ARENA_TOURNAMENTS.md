# Arena Tournaments — design & build notes

Lichess-style **Arena** tournaments for ZERTZ. Shipped incrementally: v0.18.0 (core),
v0.19.0 (scheduling / recurring / edit-delete / podium / reminders), then games-on-page
+ fixes. This is the design reference; `CLAUDE.md` has the one-paragraph summary.

## Concept

A time-boxed event. Players **Join**; while the window is open the server continuously
**auto-pairs** free players (nearest score) into rated **blitz 5+5** games. Finish a game →
you're re-paired immediately. Ranked by points on a live leaderboard; the player with the
most points when the window closes wins. **Pause** stops seeking new pairings (your current
game continues). ZERTZ has no draws.

**Locked product decisions:** berserk included; any logged-in user can create; rated blitz
5+5; scoring win=2 / loss=0 / streak ×2 (when streak≥2) / berserk +1.

## Architecture

- **`server/arenaEngine.js`** — the engine: a single `setInterval` (~4s) started in
  `server.js` `startServer()`. **The only server-side background timer in the codebase**
  (everything else is request-driven). Single in-process loop is safe because deployment is
  single-instance Docker Compose; all state is in Postgres so it survives restarts. Each tick:
  1. `materializeSchedules()` — create the next instance of each active recurring schedule.
  2. `transitionWindows()` — `scheduled → active` (`starts_at ≤ now`), `active → finished`
     (`finishes_at ≤ now`); announces starts in global chat (`[TOURNAMENT]…`).
  3. `reconcileFinishedGames()` — for each unscored `tournament_games` whose room has a winner,
     apply `applyGameResult`, update scores/streaks, free both players, AFK-auto-pause a player
     who flagged without moving.
  4. `finalizeWinners()` — set `winner_user_id` once a finished tournament's games are all scored.
  5. `sendReminders()` — web-push joined players ~2 min before start (`reminder_sent` guard).
  6. `pairActiveTournaments()` — `buildPairings` over free players, insert rooms + `tournament_games`.
  A `_ticking` guard prevents overlap; DB work uses transactions / conditional updates.

- **`server/utils/arena.js`** — PURE, unit-tested (`arena.test.js`): `buildPairings`,
  `applyGameResult`, `nextOccurrence`. Keep them pure — this is the only real test coverage
  (the rest needs a 2-account browser test).

- **`server/routes/tournaments.js`** — the API (below). **`server/utils/pgTime.js`** `pgUtc(ms)`
  formats epoch-ms as a bare UTC timestamp string (matches the db.js UTC read parser).

- **Client:** `src/store/tournamentStore.ts` (polling store), `src/db/tournamentApi.ts`,
  `src/components/Tournaments/` (`TournamentsScreen`, `TournamentDetailScreen`, `TournamentForm`,
  `TournamentLiveGames`, `useTournamentGames`, `format`). Lazy routes in `App.tsx`; nav in `MainMenu`.

## Data model (`server/db.js`, idempotent)

- **`tournaments`** — `id, name, created_by, board_size, time_control_*, rated, berserk_enabled,
  starts_at, duration_min, finishes_at, status ('scheduled'|'active'|'finished'), state_json,
  tree_json` (canonical game seed reused for every paired game), `winner_user_id, schedule_id,
  reminder_sent`.
- **`tournament_players`** — PK `(tournament_id, user_id)`; `score, streak, games_played, paused,
  current_room_id` (null = free to pair), denormalized `username/rating/country`.
- **`tournament_games`** — `id, tournament_id, room_id, user1_id, user2_id, p1_berserk, p2_berserk,
  winner_user_id, scored` (idempotency guard).
- **`tournament_schedules`** — recurring template: `freq ('daily'|'weekly'), utc_weekday, utc_minute`
  (DST-free, derived from the creator's first-run instant), template fields, `active, last_start_at`.

## Scoring (`applyGameResult`, pure)

- Win = 2; **doubled to 4** when the winner's streak *before* the game ≥ 2 ("on fire").
- **Berserk +1** if the winner berserked and the game reached the min move count (stacks with the
  double). Loser: 0, streak reset. Cancelled (winner=0): no change, not counted.

## Endpoints (`/api/tournaments`)

- `GET /` — list (recent/upcoming/active). `POST /` — create one-off (creator sends `startsAt` +
  game seed). `POST /schedules` — create recurring.
- `GET /:id` — tournament + standings + your status + schedule. `GET /:id/games` — `{live:[…w/
  stateJson], finished:[…result only]}` (skips cancelled).
- `POST /:id/{join,pause,resume}`. `PUT`/`DELETE /:id` (creator, scheduled-only).
  `PUT`/`DELETE /schedules/:id` (edit/stop series).
- Berserk lives on the room: `POST /api/rooms/:id/berserk` (halves the caller's clock, sets the
  `tournament_games` flag; only before your first move).

## Non-obvious gotchas

1. **Clocks tick immediately** — arena rooms set `clock_running_since = NOW()` at creation, so an
   AFK paired player flags without moving (engine then auto-pauses them).
2. **Recurring skip-on-delete** — `last_start_at` means deleting one materialized instance skips
   exactly that occurrence rather than recreating it; editing a series resets it and re-materializes.
3. **Resign on any turn** — `PUT /api/rooms/:id/state` lets `winType==='surrender'` bypass the
   turn check + clock deduction (fixed a general bug, not arena-only).
4. **Browse while playing** — `/tournaments/:id` auto-opens your game ONLY on a NEW pairing
   (`localStorage['zertz_arena_entered:<tid>']`, room ids are unique). RoomScreen header has a
   "🏆 back to arena" link during live play. You can't be double-paired (engine needs
   `current_room_id IS NULL`).
5. **Live previews from server state** — `TournamentLiveGames` renders `deserializeState(stateJson)`
   → `<HexBoard state preview/>` (NOT `MiniGamePreview`, which is IndexedDB-only). Spectate/review
   both go to `/room/:id?watch=1`.

## Deferred / not built
Per-arena chat; monthly recurrence; emergency-stop of a running tournament; duration presets;
rating restriction (explicitly declined); per-game POINTS in the standings markers (needs streak
replay); aggregating games across a recurring series; faithful berserk increment-removal
(needs per-player increment columns).
