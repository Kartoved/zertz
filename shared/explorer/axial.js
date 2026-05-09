/**
 * Axial coordinate transformations for hex board canonicalization.
 *
 * The 12 symmetries of a regular hexagonal board are 6 rotations
 * (0°, 60°, 120°, 180°, 240°, 300°) optionally composed with a reflection.
 * Computations are done in cube coordinates (x, y, z) with x+y+z=0, then
 * converted back to axial (q=x, r=z).
 *
 * Note: not every board size has full D6 symmetry. The 48-ring "tournament"
 * board is asymmetric — see boardSymmetries() for the valid transforms per
 * size.
 */

// Row templates per board size — kept in sync with src/game/Board.ts.
const ROW_TEMPLATES = {
  37: { rowLengths: [4, 5, 6, 7, 6, 5, 4],     startQs: [0, -1, -2, -3, -3, -3, -3] },
  48: { rowLengths: [4, 5, 6, 7, 8, 7, 6, 5],  startQs: [0, -1, -2, -3, -4, -4, -4, -4] },
  61: { rowLengths: [5, 6, 7, 8, 9, 8, 7, 6, 5], startQs: [0, -1, -2, -3, -4, -4, -4, -4, -4] },
};

/**
 * Apply transform `i` (0..11) to axial coords (q, r) around the origin.
 * 0..5 = pure rotations by i*60°; 6..11 = the same rotations composed
 * with a y↔z swap (reflection across the q-axis).
 *
 * @param {number} q
 * @param {number} r
 * @param {number} i  Transform index 0..11.
 * @returns {{ q: number, r: number }}
 */
function transformAxial(q, r, i) {
  const rotIdx = i % 6;
  const reflected = i >= 6;
  // axial → cube
  let x = q;
  let y = -q - r;
  let z = r;
  // rotation around the cube origin
  switch (rotIdx) {
    case 0: break;
    case 1: { const nx = -z, ny = -x, nz = -y; x = nx; y = ny; z = nz; break; }
    case 2: { const nx =  y, ny =  z, nz =  x; x = nx; y = ny; z = nz; break; }
    case 3: { x = -x; y = -y; z = -z; break; }
    case 4: { const nx =  z, ny =  x, nz =  y; x = nx; y = ny; z = nz; break; }
    case 5: { const nx = -y, ny = -z, nz = -x; x = nx; y = ny; z = nz; break; }
  }
  // optional reflection across the q-axis (swap y and z)
  if (reflected) {
    const t = y; y = z; z = t;
  }
  return { q: x, r: z };
}

/**
 * @param {37|48|61} size
 * @returns {Array<{ q: number, r: number }>}
 */
function generateBoardCoords(size) {
  const tmpl = ROW_TEMPLATES[size];
  if (!tmpl) throw new Error(`Unknown board size: ${size}`);
  const coords = [];
  for (let r = 0; r < tmpl.rowLengths.length; r++) {
    for (let i = 0; i < tmpl.rowLengths[r]; i++) {
      coords.push({ q: tmpl.startQs[r] + i, r });
    }
  }
  return coords;
}

/**
 * Geometric center of the board in axial coordinates. For 37 and 61 this is
 * an integer point; for 48 it's half-integer (board is asymmetric).
 *
 * @param {37|48|61} size
 * @returns {{ q: number, r: number }}
 */
function boardCenter(size) {
  const coords = generateBoardCoords(size);
  let sumQ = 0, sumR = 0;
  for (const c of coords) { sumQ += c.q; sumR += c.r; }
  return { q: sumQ / coords.length, r: sumR / coords.length };
}

const SYMMETRY_CACHE = new Map();

/**
 * Returns the indices of valid symmetries for the given board size — i.e.,
 * those transforms that, when applied around the board's geometric center,
 * map the coordinate set to itself. 37 and 61 yield all 12 (full D6); 48
 * yields a smaller subset (board is not 6-fold symmetric).
 *
 * @param {37|48|61} size
 * @returns {number[]}
 */
function boardSymmetries(size) {
  if (SYMMETRY_CACHE.has(size)) return SYMMETRY_CACHE.get(size);
  const coords = generateBoardCoords(size);
  const center = boardCenter(size);
  const original = new Set(coords.map(c => `${c.q},${c.r}`));
  const valid = [];
  for (let t = 0; t < 12; t++) {
    let ok = true;
    for (const c of coords) {
      const result = applyBoardTransform(c.q, c.r, size, t);
      if (!Number.isInteger(result.q) || !Number.isInteger(result.r)) { ok = false; break; }
      if (!original.has(`${result.q},${result.r}`)) { ok = false; break; }
    }
    if (ok) valid.push(t);
  }
  SYMMETRY_CACHE.set(size, valid);
  return valid;
}

/**
 * Apply transform `i` to axial (q, r) around the board's geometric center.
 *
 * @param {number} q
 * @param {number} r
 * @param {37|48|61} size
 * @param {number} i  Transform index 0..11.
 * @returns {{ q: number, r: number }}
 */
function applyBoardTransform(q, r, size, i) {
  const center = boardCenter(size);
  const localQ = q - center.q;
  const localR = r - center.r;
  const t = transformAxial(localQ, localR, i);
  return { q: t.q + center.q, r: t.r + center.r };
}

/**
 * Inverse of transform `i`. The 6 rotations form a cyclic group (rot_k's
 * inverse is rot_{6-k mod 6}); the 6 reflections (indices 6..11) are each
 * their own inverse because in D6 every reflection has order 2.
 */
const INVERSE_TRANSFORM = [0, 5, 4, 3, 2, 1, 6, 7, 8, 9, 10, 11];

/**
 * @param {number} i  Transform index 0..11.
 * @returns {number}  Inverse transform index.
 */
function inverseTransform(i) {
  return INVERSE_TRANSFORM[i];
}

export {
  transformAxial,
  generateBoardCoords,
  boardCenter,
  boardSymmetries,
  applyBoardTransform,
  inverseTransform,
};
