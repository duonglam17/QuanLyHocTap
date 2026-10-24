import { describe, expect, it } from 'vitest';
import { formatDateTime, formatFileSize, formatScore } from './formatters.js';

describe('shared formatters', () => {
  it('formats missing scores as not yet available', () => {
    expect(formatScore(null)).toBe('Chưa có');
    expect(formatScore(8.5)).toBe('8,5');
  });

  it('formats file sizes and dates in Vietnamese', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatDateTime('2026-11-30T17:00:00Z')).toContain('01/12/2026');
  });
});
