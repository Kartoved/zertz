// Format epoch ms as a bare UTC 'YYYY-MM-DD HH:MM:SS' string for `timestamp
// without time zone` columns. Timezone-independent: it stores the UTC wall-clock
// verbatim, matching the db.js read parser (which appends 'Z'). Used for
// client-supplied / computed tournament times.
export function pgUtc(ms) {
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}
