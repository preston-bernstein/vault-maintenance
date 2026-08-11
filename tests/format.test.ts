import { describe, it, expect } from 'vitest';
import {
  formatError,
  isValidDate,
  toISODateString,
} from '../src/utils/format.js';

describe('formatError', () => {
  it('returns message for Error', () => {
    expect(formatError(new Error('fail'))).toBe('fail');
  });
  it('returns String(value) for non-Error', () => {
    expect(formatError('oops')).toBe('oops');
  });
});

describe('isValidDate', () => {
  it('returns true for valid Date', () => {
    expect(isValidDate(new Date())).toBe(true);
  });
  it('returns false for invalid Date', () => {
    expect(isValidDate(new Date('invalid'))).toBe(false);
  });
  it('returns false for non-Date', () => {
    expect(isValidDate(null)).toBe(false);
    expect(isValidDate('2026-01-01')).toBe(false);
  });
});

describe('toISODateString', () => {
  it('returns YYYY-MM-DD for valid date', () => {
    expect(toISODateString(new Date('2026-02-08T12:00:00Z'))).toBe(
      '2026-02-08',
    );
  });
  it('falls back to today for invalid date', () => {
    const result = toISODateString(new Date('invalid'));
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
