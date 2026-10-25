import { describe, expect, it } from 'vitest';
import { getSafeRedirectPath } from './redirects.js';

describe('getSafeRedirectPath', () => {
  it('accepts internal paths, including query strings and hashes', () => {
    expect(getSafeRedirectPath('/m2/assignments/4?tab=details#submission'))
      .toBe('/m2/assignments/4?tab=details#submission');
  });

  it.each(['https://example.com', '//example.com', '/\\example.com', '/m2?next=https://example.com'])(
    'rejects unsafe redirect paths: %s',
    (path) => {
      expect(getSafeRedirectPath(path)).toBeNull();
    }
  );

  it('rejects non-string and relative paths', () => {
    expect(getSafeRedirectPath(null)).toBeNull();
    expect(getSafeRedirectPath('m2/assignments/4')).toBeNull();
  });
});
