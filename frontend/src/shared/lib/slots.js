const headerWidgetModules = import.meta.glob('../../modules/*/header-widget.jsx', {
  eager: true,
  import: 'default'
});
const courseTabModules = import.meta.glob('../../modules/*/course-tabs.jsx', {
  eager: true,
  import: 'default'
});
const lessonSectionModules = import.meta.glob('../../modules/*/lesson-sections.jsx', {
  eager: true,
  import: 'default'
});

function allowedForRole(item, role) {
  return !role || !Array.isArray(item.roles) || item.roles.length === 0 || item.roles.includes(role);
}

function flattenSlotModules(modules) {
  return Object.entries(modules).flatMap(([filePath, value]) => {
    if (!value) return [];
    const moduleName = filePath.match(/modules\/(m[1-3])\//)?.[1];
    if (!moduleName) {
      throw new TypeError(`Slot file "${filePath}" does not belong to an LMS module.`);
    }
    return [{ filePath, moduleName, value }];
  });
}

export function getHeaderWidgets(role) {
  return flattenSlotModules(headerWidgetModules)
    .filter(({ value }) => typeof value === 'function' && allowedForRole(value, role))
    .map(({ moduleName, value: Component }) => ({ moduleName, Component }));
}

function getOrderedEntries(modules, role, getOrder) {
  const entries = flattenSlotModules(modules).flatMap(({ filePath, moduleName, value }) => {
    if (!Array.isArray(value)) {
      throw new TypeError(`Slot file "${filePath}" must export an array.`);
    }
    return value
      .filter((item) => item && allowedForRole(item, role))
      .map((item) => ({ ...item, moduleName }));
  });

  const seenIds = new Set();
  entries.forEach((entry) => {
    if (typeof entry.id !== 'string' || !entry.id) {
      throw new TypeError('Every slot entry must declare a non-empty id.');
    }
    if (seenIds.has(entry.id)) throw new TypeError(`Duplicate slot id "${entry.id}".`);
    seenIds.add(entry.id);
  });

  return entries.sort((left, right) => getOrder(left) - getOrder(right));
}

export function getCourseTabs(role) {
  return getOrderedEntries(courseTabModules, role, (tab) => tab.order ?? 0);
}

export function getLessonSections(role) {
  return getOrderedEntries(lessonSectionModules, role, (section) => section.order ?? 0);
}
