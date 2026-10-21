export function discoverModuleRoutes(routeModules) {
  return Object.entries(routeModules)
    .flatMap(([filePath, moduleRoutes]) => {
      if (!Array.isArray(moduleRoutes)) {
        throw new TypeError(`Route file "${filePath}" must export a routes array.`);
      }

      return moduleRoutes;
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}
