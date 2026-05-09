/**
 * Backfill the opening-explorer index from existing finished rooms.
 *
 * Idempotent: skips rooms that have already been indexed (rows with
 * explorer_indexed_at set). Safe to re-run.
 *
 * Usage:
 *   node server/scripts/backfillExplorer.js
 */

import { pool, ensureSchema } from '../db.js';
import { backfillUnindexedRooms } from '../explorer.js';

async function main() {
  console.log('[backfill-explorer] ensuring schema...');
  await ensureSchema();
  console.log('[backfill-explorer] running backfill...');
  const start = Date.now();
  const summary = await backfillUnindexedRooms(pool);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[backfill-explorer] done in ${elapsed}s — rooms=${summary.rooms} entries=${summary.entries}`);
}

main()
  .catch((err) => {
    console.error('[backfill-explorer] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
