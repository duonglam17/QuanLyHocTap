export function discoverModuleRoutes(routeModules) {
  const routes = Object.entries(routeModules)
    .flatMap(([filePath, moduleRoutes]) => {
      if (!Array.isArray(moduleRoutes)) {
        throw new TypeError(`Route file "${filePath}" must export a routes array.`);
      }

      return moduleRoutes.map((route) => {
        if (!route || typeof route.path !== 'string' || !route.path.startsWith('/')) {
          throw new TypeError(`Routes in "${filePath}" must have an absolute path.`);
        }
        if (route.roles !== undefined && !Array.isArray(route.roles)) {
          throw new TypeError(`Route "${route.path}" in "${filePath}" must declare roles as an array.`);
        }
        if (route.public !== true && !Array.isArray(route.roles)) {
          throw new TypeError(`Route "${route.path}" in "${filePath}" must declare roles.`);
        }
        if (route.roles?.some((role) => typeof role !== 'string')) {
          throw new TypeError(`Route "${route.path}" in "${filePath}" has an invalid role.`);
        }
        if (!route.element) {
          throw new TypeError(`Route "${route.path}" in "${filePath}" must declare an element.`);
        }
        if (route.public !== undefined && typeof route.public !== 'boolean') {
          throw new TypeError(`Route "${route.path}" must declare public as a boolean.`);
        }

        const layout = route.layout ?? 'default';
        if (layout !== 'default' && layout !== 'bare') {
          throw new TypeError(`Route "${route.path}" must use the "default" or "bare" layout.`);
        }
        if (route.nav && typeof route.nav.label !== 'string') {
          throw new TypeError(`Navigation metadata for "${route.path}" must include a label.`);
        }
        if (
          route.homeFor !== undefined &&
          (!Array.isArray(route.homeFor) || route.homeFor.some((role) => typeof role !== 'string'))
        ) {
          throw new TypeError(`Route "${route.path}" must declare homeFor as an array of roles.`);
        }

        return {
          ...route,
          public: route.public ?? false,
          roles: route.roles ?? [],
          layout
        };
      });
    })
    .sort((left, right) => left.path.localeCompare(right.path));

  const seenPaths = new Set();
  routes.forEach((route) => {
    if (seenPaths.has(route.path)) {
      throw new TypeError(`Duplicate route path "${route.path}" was discovered.`);
    }
    seenPaths.add(route.path);
  });

  return routes;
}

export function addLoginFallback(moduleRoutes, fallbackRoute) {
  const moduleLoginRoute = moduleRoutes.find((route) => route.path === '/login');
  if (moduleLoginRoute) {
    return moduleRoutes.map((route) =>
      route === moduleLoginRoute ? { ...route, public: true, layout: 'bare' } : route
    );
  }

  return [...moduleRoutes, { ...fallbackRoute, public: true, layout: 'bare' }];
}
