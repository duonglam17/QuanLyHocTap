import { describe, expect, it } from 'vitest';
import { getSafeRedirectPath } from './redirects.js';

describe('getSafeRedirectPath', () => {
  it('accepts internal paths, including query strings and hashes', () => {
    expect(getSafeRedirectPath('/protected/items/4?tab=details#submission')).toBe(
      '/protected/items/4?tab=details#submission'
    );
  });

  it.each([
    'https://example.com',
    '//example.com',
    '/\\example.com',
    '/protected?next=https://example.com'
  ])('rejects unsafe redirect paths: %s', (path) => {
    expect(getSafeRedirectPath(path)).toBeNull();
  });

  it('rejects non-string and relative paths', () => {
    expect(getSafeRedirectPath(null)).toBeNull();
    expect(getSafeRedirectPath('protected/items/4')).toBeNull();
  });
});
