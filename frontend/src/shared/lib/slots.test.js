import { describe, expect, it } from 'vitest';
import { getCourseTabs, getHeaderWidgets, getLessonSections } from './slots.js';

describe('module slots', () => {
  it('loads M2 course tabs and keeps the other slot registries empty', () => {
    expect(getCourseTabs('SINH_VIEN')).toEqual([
      expect.objectContaining({
        id: 'assignments',
        label: 'Bài tập',
        moduleName: 'm2',
        roles: ['GIANG_VIEN', 'SINH_VIEN']
      })
    ]);
    expect(getLessonSections('GIANG_VIEN')).toEqual([]);
    expect(getHeaderWidgets('SINH_VIEN')).toEqual([]);
  });
});
