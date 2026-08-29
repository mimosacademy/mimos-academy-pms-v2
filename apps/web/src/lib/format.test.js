import { describe, expect, it } from 'vitest';
import {
  decimalAdd,
  decimalIsZero,
  decimalIsPositive,
  decimalCompare,
  decimalToString,
  formatRM,
  formatRMCompact,
  slugify,
} from './format';

// Financial values must never drift through floating point; these tests assert
// that the decimal helpers operate on exact integer-scaled math.

describe('decimal helpers', () => {
  it('adds exact decimals without float drift', () => {
    expect(decimalAdd('0.1', '0.2')).toBe('0.3');
    expect(decimalAdd('999.99', '0.01')).toBe('1000.00');
    expect(decimalAdd('1000', '0.00')).toBe('1000.00');
  });

  it('handles negative values and carries signs', () => {
    expect(decimalAdd('-5.5', '3.25')).toBe('-2.25');
    expect(decimalAdd('5.5', '-3.25')).toBe('2.25');
  });

  it('normalises and rejects invalid input', () => {
    expect(decimalToString(' 42 ')).toBe('42');
    expect(decimalToString('')).toBe('0');
    expect(() => decimalToString('12a')).toThrow(TypeError);
  });

  it('compares and classifies values', () => {
    expect(decimalCompare('1.00', '1')).toBe(0);
    expect(decimalIsPositive('0.01')).toBe(true);
    expect(decimalIsZero('0.000')).toBe(true);
    expect(decimalIsZero('0.1')).toBe(false);
  });

  it('formats ringgit with two decimals', () => {
    expect(formatRM('1234.5')).toMatch(/^RM 1,234\.50$/);
    expect(formatRM('0')).toMatch(/^RM 0\.00$/);
  });

  it('formats compact millions and thousands', () => {
    expect(formatRMCompact('2500000')).toBe('RM 2.50M');
    expect(formatRMCompact('1200')).toBe('RM 1.2K');
    expect(formatRMCompact('500')).toBe('RM 500.00');
  });

  it('slugifies display names into stable identifiers', () => {
    expect(slugify('MIMOS Academy - Programme 2026')).toBe(
      'mimos-academy-programme-2026',
    );
  });
});
