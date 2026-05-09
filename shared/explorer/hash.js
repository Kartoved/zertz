/**
 * 64-bit FNV-1a hash, returned as 16-char lowercase hex.
 *
 * Pure JS so it runs identically in Node (server-side indexer) and in the
 * browser (client computes the same hash before querying the explorer).
 * For our scale — at most ~100k unique positions across the lifetime of
 * the site — the 64-bit space gives a vanishingly small collision risk
 * while staying compact for the database column (CHAR(16)).
 *
 * @param {string} canonicalString
 * @returns {string}  16-char lowercase hex.
 */
const FNV_OFFSET_64 = 0xcbf29ce484222325n;
const FNV_PRIME_64 = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

export function hashPosition(canonicalString) {
  let h = FNV_OFFSET_64;
  for (let i = 0; i < canonicalString.length; i++) {
    h ^= BigInt(canonicalString.charCodeAt(i));
    h = (h * FNV_PRIME_64) & MASK_64;
  }
  return h.toString(16).padStart(16, '0');
}
