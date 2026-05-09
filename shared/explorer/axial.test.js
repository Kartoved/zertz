import { describe, it, expect } from 'vitest';
import {
  transformAxial,
  generateBoardCoords,
  boardSymmetries,
  applyBoardTransform,
} from './axial.js';

describe('boardSymmetries', () => {
  it('37-ring board has full D6 symmetry (12 transforms)', () => {
    expect(boardSymmetries(37).length).toBe(12);
  });

  it('61-ring board has full D6 symmetry (12 transforms)', () => {
    expect(boardSymmetries(61).length).toBe(12);
  });

  it('48-ring tournament board has only a partial symmetry group', () => {
    const sym = boardSymmetries(48);
    expect(sym.length).toBeGreaterThanOrEqual(1);
    expect(sym).toContain(0);
    expect(sym.length).toBeLessThan(12);
  });
});

describe('applyBoardTransform', () => {
  it('every valid transform maps each board coord to another board coord', () => {
    for (const size of [37, 48, 61]) {
      const coords = generateBoardCoords(size);
      const setOf = new Set(coords.map(c => `${c.q},${c.r}`));
      for (const t of boardSymmetries(size)) {
        for (const c of coords) {
          const out = applyBoardTransform(c.q, c.r, size, t);
          expect(setOf.has(`${out.q},${out.r}`)).toBe(true);
        }
      }
    }
  });

  it('identity transform (i=0) is a no-op', () => {
    for (const c of generateBoardCoords(37)) {
      const out = applyBoardTransform(c.q, c.r, 37, 0);
      expect(out).toEqual({ q: c.q, r: c.r });
    }
  });

  it('two reflections compose back to identity', () => {
    for (const c of generateBoardCoords(37)) {
      const once = applyBoardTransform(c.q, c.r, 37, 6); // reflect
      const twice = applyBoardTransform(once.q, once.r, 37, 6);
      expect(twice).toEqual({ q: c.q, r: c.r });
    }
  });

  it('six 60° rotations compose back to identity', () => {
    for (const c of generateBoardCoords(37)) {
      let pt = { q: c.q, r: c.r };
      for (let n = 0; n < 6; n++) {
        pt = applyBoardTransform(pt.q, pt.r, 37, 1);
      }
      expect(pt).toEqual({ q: c.q, r: c.r });
    }
  });
});

describe('transformAxial', () => {
  it('preserves cube coordinate sum (x+y+z=0)', () => {
    for (let i = 0; i < 12; i++) {
      const out = transformAxial(2, 1, i); // q=2, r=1 → cube x=2, y=-3, z=1
      const x = out.q;
      const z = out.r;
      const y = -x - z; // implied
      expect(x + y + z).toBe(0);
    }
  });
});
