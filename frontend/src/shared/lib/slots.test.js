import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildCourseTabs,
  buildHeaderWidgets,
  buildLessonSections,
  getCourseTabs,
  getHeaderWidgets,
  getLessonSections
} from './slots.js';

const realHeaderWidgetModules = import.meta.glob('../../modules/*/header-widget.jsx', {
  eager: true,
  import: 'default'
});
const realCourseTabModules = import.meta.glob('../../modules/*/course-tabs.jsx', {
  eager: true,
  import: 'default'
});
const realLessonSectionModules = import.meta.glob('../../modules/*/lesson-sections.jsx', {
  eager: true,
  import: 'default'
});

const validRoles = new Set(['ADMIN', 'GIANG_VIEN', 'SINH_VIEN']);
const validComponentTypes = new Set([
  Symbol.for('react.forward_ref'),
  Symbol.for('react.lazy'),
  Symbol.for('react.memo')
]);

function component(name, roles, order) {
  const Component = function SlotComponent() {
    return name;
  };
  Component.roles = roles;
  Component.order = order;
  return Component;
}

function isComponent(value) {
  return (
    typeof value === 'function' ||
    (value !== null &&
      typeof value === 'object' &&
      validComponentTypes.has(value.$$typeof))
  );
}

function assertContract(condition, filePath, requirement) {
  if (!condition) {
    throw new Error(`Slot contract violation in "${filePath}": ${requirement}`);
  }
}

function assertOrderedSlotsContract(modules, slots, slotName) {
  const seenIds = new Map();
  Object.entries(modules).forEach(([filePath, exportedSlots]) => {
    assertContract(Array.isArray(exportedSlots), filePath, 'default export must be an array');
    exportedSlots.forEach((slot) => {
      assertContract(slot && typeof slot === 'object', filePath, 'each entry must be an object');
      assertContract(typeof slot.id === 'string' && slot.id.length > 0, filePath, 'id must be a non-empty string');
      assertContract(typeof slot.order === 'number' && Number.isFinite(slot.order), filePath, 'order must be numeric');
      assertContract(
        Array.isArray(slot.roles) && slot.roles.every((role) => validRoles.has(role)),
        filePath,
        'roles must contain only ADMIN, GIANG_VIEN, or SINH_VIEN'
      );
      assertContract(isComponent(slot.Component), filePath, 'Component must be a valid React component');
      assertContract(!seenIds.has(slot.id), filePath, `id "${slot.id}" duplicates "${seenIds.get(slot.id)}" in ${slotName}`);
      seenIds.set(slot.id, filePath);
    });
  });

  slots.forEach((slot) => {
    assertContract(typeof slot.id === 'string' && slot.id.length > 0, slot.moduleName, 'returned id must be a non-empty string');
    assertContract(typeof slot.order === 'number' && Number.isFinite(slot.order), slot.moduleName, 'returned order must be numeric');
    assertContract(
      Array.isArray(slot.roles) && slot.roles.every((role) => validRoles.has(role)),
      slot.moduleName,
      'returned roles must contain only ADMIN, GIANG_VIEN, or SINH_VIEN'
    );
    assertContract(isComponent(slot.Component), slot.moduleName, 'returned Component must be a valid React component');
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('module slot builders', () => {
  it('filters by role and sorts widgets, course tabs, and lesson sections by order', () => {
    const widgets = {
      '../../modules/m1/header-widget.jsx': component('student-widget', ['SINH_VIEN'], 20),
      '../../modules/m2/header-widget.jsx': component('admin-widget', ['ADMIN'], 10)
    };
    const tabs = {
      '../../modules/m1/course-tabs.jsx': [
        { id: 'late', label: 'Sau', order: 20, roles: ['SINH_VIEN'], Component: component('late') },
        { id: 'staff', label: 'Nhân viên', order: 5, roles: ['GIANG_VIEN'], Component: component('staff') }
      ],
      '../../modules/m2/course-tabs.jsx': [
        { id: 'early', label: 'Trước', order: 10, roles: ['SINH_VIEN'], Component: component('early') }
      ]
    };
    const sections = {
      '../../modules/m1/lesson-sections.jsx': [
        { id: 'discussion', order: 15, roles: ['SINH_VIEN'], Component: component('discussion') }
      ],
      '../../modules/m3/lesson-sections.jsx': [
        { id: 'resources', order: 5, roles: ['SINH_VIEN'], Component: component('resources') }
      ]
    };

    expect(buildHeaderWidgets(widgets, 'SINH_VIEN').map(({ moduleName }) => moduleName))
      .toEqual(['m1']);
    expect(buildCourseTabs(tabs, 'SINH_VIEN').map(({ id }) => id)).toEqual(['early', 'late']);
    expect(buildLessonSections(sections, 'SINH_VIEN').map(({ id }) => id))
      .toEqual(['resources', 'discussion']);
  });

  it('warns and skips modules or entries without valid exports', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const malformedModules = {
      '../../modules/m1/course-tabs.jsx': null,
      '../../modules/m2/course-tabs.jsx': [
        null,
        { id: 'bad-component', order: 1, roles: ['SINH_VIEN'], Component: 'not a component' },
        { id: 'valid', order: 2, roles: ['SINH_VIEN'], Component: component('valid') }
      ]
    };
    const malformedWidgets = {
      '../../modules/m1/header-widget.jsx': 'not a component',
      '../../modules/m2/header-widget.jsx': component('valid', ['SINH_VIEN'], 1)
    };

    expect(buildCourseTabs(malformedModules, 'SINH_VIEN').map(({ id }) => id)).toEqual(['valid']);
    expect(buildLessonSections({ '../../modules/m1/lesson-sections.jsx': {} }, 'SINH_VIEN'))
      .toEqual([]);
    expect(buildHeaderWidgets(malformedWidgets, 'SINH_VIEN').map(({ moduleName }) => moduleName))
      .toEqual(['m2']);
    expect(warning).toHaveBeenCalledTimes(5);
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('../../modules/m1/course-tabs.jsx'));
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('../../modules/m1/header-widget.jsx'));
  });

  it('reports duplicate identifiers with both conflicting slot files', () => {
    const duplicateTabs = {
      '../../modules/m1/course-tabs.jsx': [
        { id: 'same', order: 1, roles: ['SINH_VIEN'], Component: component('first') }
      ],
      '../../modules/m2/course-tabs.jsx': [
        { id: 'same', order: 2, roles: ['GIANG_VIEN'], Component: component('second') }
      ]
    };

    expect(() => buildCourseTabs(duplicateTabs, 'SINH_VIEN')).toThrow(
      /Duplicate course tab id "same".*m1\/course-tabs\.jsx.*m2\/course-tabs\.jsx/
    );
  });

  it('returns an empty list when no slot grants access to the requested role', () => {
    const tabs = {
      '../../modules/m1/course-tabs.jsx': [
        { id: 'staff', order: 1, roles: ['GIANG_VIEN'], Component: component('staff') }
      ]
    };
    const sections = {
      '../../modules/m2/lesson-sections.jsx': [
        { id: 'admin', order: 1, roles: ['ADMIN'], Component: component('admin') }
      ]
    };
    const widgets = {
      '../../modules/m3/header-widget.jsx': component('admin-widget', ['ADMIN'], 1)
    };

    expect(buildCourseTabs(tabs, 'SINH_VIEN')).toEqual([]);
    expect(buildLessonSections(sections, 'SINH_VIEN')).toEqual([]);
    expect(buildHeaderWidgets(widgets, 'SINH_VIEN')).toEqual([]);
  });
});

describe('real module slot contracts', () => {
  it('keeps real slots compatible without assuming any specific module or count', () => {
    assertOrderedSlotsContract(
      realCourseTabModules,
      getCourseTabs(),
      'course tabs'
    );
    assertOrderedSlotsContract(
      realLessonSectionModules,
      getLessonSections(),
      'lesson sections'
    );

    Object.entries(realHeaderWidgetModules).forEach(([filePath, Component]) => {
      assertContract(isComponent(Component), filePath, 'default export must be a valid React component');
    });

    expect(getCourseTabs()).toEqual(buildCourseTabs(realCourseTabModules));
    expect(getLessonSections()).toEqual(buildLessonSections(realLessonSectionModules));
    expect(getHeaderWidgets()).toEqual(buildHeaderWidgets(realHeaderWidgetModules));
  });
});
