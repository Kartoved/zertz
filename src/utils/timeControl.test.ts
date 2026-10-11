import { describe, it, expect } from 'vitest';
import { formatTimeControl, formatTimeControlShort, timeControlCategory } from './timeControl';
import { I18N } from '../i18n';

const MIN = 60_000;

describe('timeControl', () => {
  it('formats the short form, including correspondence and untimed', () => {
    expect(formatTimeControlShort(5 * MIN, 5000)).toBe('5+5');
    expect(formatTimeControlShort(15 * MIN, 0)).toBe('15+0');
    expect(formatTimeControlShort(7 * 24 * 60 * MIN, -1)).toBe('7d');
    expect(formatTimeControlShort(null, null)).toBe('∞');
    // BIGINT columns can arrive as strings from node-postgres
    expect(formatTimeControlShort('300000' as unknown as number, '5000' as unknown as number)).toBe('5+5');
  });

  it('categorizes the presets', () => {
    expect(timeControlCategory(5 * MIN, 5000)).toBe('blitz');
    expect(timeControlCategory(15 * MIN, 0)).toBe('rapid');
    expect(timeControlCategory(30 * MIN, 0)).toBe('long');
    expect(timeControlCategory(7 * 24 * 60 * MIN, -1)).toBe('correspondence');
    expect(timeControlCategory(null, null)).toBeNull();
  });

  it('builds a localized label', () => {
    expect(formatTimeControl(I18N.ru, 5 * MIN, 5000)).toBe('Блиц 5+5');
    expect(formatTimeControl(I18N.en, null, null)).toBe(I18N.en.noTimeControl);
  });
});
