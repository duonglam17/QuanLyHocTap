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

const validRoles = new Set(['ADMIN', 'GIANG_VIEN', 'SINH_VIEN']);
const componentTypes = new Set([
  Symbol.for('react.forward_ref'),
  Symbol.for('react.lazy'),
  Symbol.for('react.memo')
]);

function moduleNameFromPath(filePath) {
  const moduleName = filePath.replace(/\\/g, '/').match(/(?:^|\/)modules\/(m[1-3])\//)?.[1];
  if (!moduleName) {
    throw new TypeError(`Slot file "${filePath}" does not belong to an LMS module.`);
  }
  return moduleName;
}

function warnInvalidSlot(filePath, reason) {
  console.warn(`Ignoring invalid slot in "${filePath}": ${reason}`);
}

function isComponent(value) {
  return (
    typeof value === 'function' ||
    (value !== null &&
      typeof value === 'object' &&
      componentTypes.has(value.$$typeof))
  );
}

function hasValidRoles(roles) {
  return Array.isArray(roles) && roles.every((role) => validRoles.has(role));
}

function isAllowedForRole(roles, role) {
  return !role || roles.length === 0 || roles.includes(role);
}

function entriesForOrderedSlots(modules, role, slotName) {
  const entries = [];
  const seenIds = new Map();

  Object.entries(modules).forEach(([filePath, value]) => {
    const moduleName = moduleNameFromPath(filePath);
    if (!Array.isArray(value)) {
      warnInvalidSlot(filePath, 'expected a default export array');
      return;
    }

    value.forEach((item, index) => {
      if (!item || typeof item !== 'object') {
        warnInvalidSlot(filePath, `entry ${index} must be an object`);
        return;
      }
      if (typeof item.id !== 'string' || item.id.length === 0) {
        warnInvalidSlot(filePath, `entry ${index} must have a non-empty string id`);
        return;
      }
      if (typeof item.order !== 'number' || !Number.isFinite(item.order)) {
        warnInvalidSlot(filePath, `slot "${item.id}" must have a numeric order`);
        return;
      }
      if (!hasValidRoles(item.roles)) {
        warnInvalidSlot(
          filePath,
          `slot "${item.id}" must have a roles array containing only ADMIN, GIANG_VIEN, or SINH_VIEN`
        );
        return;
      }
      if (!isComponent(item.Component)) {
        warnInvalidSlot(filePath, `slot "${item.id}" must have a valid Component`);
        return;
      }

      const previousFile = seenIds.get(item.id);
      if (previousFile) {
        throw new TypeError(
          `Duplicate ${slotName} id "${item.id}" in "${previousFile}" and "${filePath}".`
        );
      }
      seenIds.set(item.id, filePath);

      if (isAllowedForRole(item.roles, role)) {
        entries.push({ ...item, moduleName });
      }
    });
  });

  return entries.sort((left, right) => left.order - right.order);
}

export function buildHeaderWidgets(modules, role) {
  const widgets = [];

  Object.entries(modules).forEach(([filePath, Component]) => {
    const moduleName = moduleNameFromPath(filePath);
    if (!isComponent(Component)) {
      warnInvalidSlot(filePath, 'expected a valid default-exported component');
      return;
    }

    const roles = Component.roles ?? [];
    if (!Array.isArray(roles) || !roles.every((value) => validRoles.has(value))) {
      warnInvalidSlot(
        filePath,
        'component roles metadata must contain only ADMIN, GIANG_VIEN, or SINH_VIEN'
      );
      return;
    }
    const order = Component.order ?? 0;
    if (typeof order !== 'number' || !Number.isFinite(order)) {
      warnInvalidSlot(filePath, 'component order metadata must be numeric');
      return;
    }

    if (isAllowedForRole(roles, role)) {
      widgets.push({ moduleName, Component, order });
    }
  });

  return widgets
    .sort((left, right) => left.order - right.order)
    .map(({ moduleName, Component }) => ({ moduleName, Component }));
}

export function buildCourseTabs(modules, role) {
  return entriesForOrderedSlots(modules, role, 'course tab');
}

export function buildLessonSections(modules, role) {
  return entriesForOrderedSlots(modules, role, 'lesson section');
}

export function getHeaderWidgets(role) {
  return buildHeaderWidgets(headerWidgetModules, role);
}

export function getCourseTabs(role) {
  return buildCourseTabs(courseTabModules, role);
}

export function getLessonSections(role) {
  return buildLessonSections(lessonSectionModules, role);
}
