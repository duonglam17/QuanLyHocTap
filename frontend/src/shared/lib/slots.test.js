import { describe, expect, it } from 'vitest';
import { getCourseTabs, getHeaderWidgets, getLessonSections } from './slots.js';

describe('module slots', () => {
  it('loads the fixed course-tab, lesson-section, and header-widget registries', () => {
    expect(getCourseTabs('SINH_VIEN')).toEqual([]);
    expect(getLessonSections('GIANG_VIEN')).toEqual([]);
    expect(getHeaderWidgets('SINH_VIEN')).toEqual([]);
  });
});
