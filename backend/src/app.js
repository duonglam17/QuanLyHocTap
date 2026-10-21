const cors = require('cors');
const express = require('express');
const fs = require('fs');
const helmet = require('helmet');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');

const common = require('./common');
const contracts = require('./contracts');
const errorHandler = common.errorHandler;
const { NotFoundError } = common.errors;
const logger = common.logger;

const modulesDirectory = path.join(__dirname, 'modules');
const openApiDirectory = path.resolve(__dirname, '../../docs/openapi');
const openApiDocuments = ['common.yaml', 'm1.yaml', 'm2.yaml', 'm3.yaml'];

function normalizePath(...segments) {
  const joined = segments.filter(Boolean).join('/');
  const normalized = `/${joined}`.replace(/\/+/g, '/');
  return normalized.length > 1 ? normalized.replace(/\/$/, '') : normalized;
}

function canonicalPath(routePath) {
  return routePath.replace(/:([A-Za-z0-9_]+)(?:\([^)]*\))?([?*+]?)?/g, ':param$2').toLowerCase();
}

function routePaths(routePath) {
  if (Array.isArray(routePath)) {
    return routePath.flatMap(routePaths);
  }
  return [typeof routePath === 'string' ? routePath : String(routePath)];
}

function mountPathFromLayer(layer) {
  if (typeof layer.path === 'string') {
    return layer.path;
  }
  if (layer.regexp?.fast_slash) {
    return '';
  }

  const source = layer.regexp?.source || '';
  const prefix = source.match(/^\^((?:\\\/|[A-Za-z0-9_.-])*)/);
  return prefix ? prefix[1].replace(/\\/g, '') : '';
}

function collectRoutes(router, prefix = '', onRoute) {
  for (const layer of router.stack) {
    if (layer.route) {
      for (const routePath of routePaths(layer.route.path)) {
        onRoute(normalizePath(prefix, routePath), layer.route);
      }
    } else if (layer.handle?.stack) {
      collectRoutes(layer.handle, normalizePath(prefix, mountPathFromLayer(layer)), onRoute);
    }
  }
}

function findLegacyPingLayer(router) {
  return router.stack.find(
    (layer) =>
      layer.route &&
      routePaths(layer.route.path).some((routePath) => normalizePath(routePath) === '/ping') &&
      layer.route.methods.get
  );
}

function registerRoute(routeMap, method, routePath, moduleName) {
  const key = `${method.toUpperCase()} ${canonicalPath(routePath)}`;
  if (method.toLowerCase() === '_all') {
    const existingMethod = [...routeMap.keys()].find((existing) =>
      existing.endsWith(` ${canonicalPath(routePath)}`)
    );
    if (existingMethod) {
      throw new Error(
        `Trùng route ${existingMethod} và ALL ${canonicalPath(routePath)} giữa các module.`
      );
    }
  } else if (routeMap.has(`ALL ${canonicalPath(routePath)}`)) {
    throw new Error(
      `Trùng route ALL và ${method.toUpperCase()} ${canonicalPath(routePath)} giữa các module.`
    );
  }
  const previousModule = routeMap.get(key);
  if (previousModule) {
    throw new Error(`Trùng route ${key} giữa module "${previousModule}" và "${moduleName}".`);
  }
  routeMap.set(key, moduleName);
}

function loadModules(app, directory, baseContext = {}) {
  const moduleDirectories = fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));
  const contractRegistry = baseContext.contracts || contracts.createRegistry();
  const context = Object.freeze({
    ...baseContext,
    app,
    common,
    config: common.config,
    db: common.db,
    logger,
    contracts: contractRegistry
  });

  const records = moduleDirectories.flatMap((entry) => {
    const moduleEntry = path.join(directory, entry.name, 'index.js');
    if (!fs.existsSync(moduleEntry)) {
      return [];
    }

    const exported = require(moduleEntry);
    let router = typeof exported === 'function' ? exported : exported?.router;
    const init = exported?.init || router?.init;
    if (typeof init === 'function') {
      const initialized = init(context);
      if (initialized && typeof initialized.then === 'function') {
        throw new TypeError(`Module "${entry.name}" init(ctx) must be synchronous.`);
      }
      if (initialized) {
        router = typeof initialized === 'function' ? initialized : initialized.router || router;
      }
    }

    if (typeof router !== 'function' || !Array.isArray(router.stack)) {
      throw new TypeError(`Module "${entry.name}" must export an Express router.`);
    }

    return [{ name: entry.name, router, legacyPingLayer: findLegacyPingLayer(router) }];
  });

  const routeMap = new Map();
  registerRoute(routeMap, 'GET', '/api/health', 'common');
  for (const record of records) {
    collectRoutes(record.router, '/api', (routePath, route) => {
      const isLegacyPing = routePath === '/api/ping' && route === record.legacyPingLayer?.route;
      if (isLegacyPing) {
        const methods = Object.keys(route.methods).filter((method) => route.methods[method]);
        for (const method of methods) {
          registerRoute(routeMap, method, normalizePath('/api', record.name, 'ping'), record.name);
        }
        return;
      }

      for (const method of Object.keys(route.methods).filter((name) => route.methods[name])) {
        registerRoute(routeMap, method, routePath, record.name);
      }
    });
  }

  for (const record of records) {
    const moduleRouter = express.Router();
    moduleRouter.stack = record.router.stack.filter((layer) => layer !== record.legacyPingLayer);
    app.use('/api', moduleRouter);

    if (record.legacyPingLayer) {
      const handlers = record.legacyPingLayer.route.stack.map((layer) => layer.handle);
      app.get(normalizePath('/api', record.name, 'ping'), ...handlers);
    }

    logger.info(`Đã nạp module "${record.name}" tại /api`);
  }
}

function loadOpenApiDocuments() {
  return openApiDocuments.map((filename) => {
    const filePath = path.join(openApiDirectory, filename);
    const source = fs.readFileSync(filePath, 'utf8');
    const document = YAML.parse(source);
    if (!document || !document.openapi || !document.info || !document.paths) {
      throw new TypeError(`OpenAPI document "${filename}" không hợp lệ.`);
    }
    return { filename, source, document };
  });
}

function createApp(directory = modulesDirectory, baseContext = {}) {
  const app = express();
  const documents = loadOpenApiDocuments();

  app.use(helmet());
  app.use(cors({ origin: common.config.CORS_ORIGIN }));
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: common.clock.now().toISOString(),
      uptime: process.uptime()
    });
  });

  loadModules(app, directory, baseContext);

  app.use('/api-docs', (req, res, next) => {
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'"
      ].join('; ')
    );
    next();
  });

  app.get('/api-docs', (req, res, next) => {
    if (req.path !== '/api-docs') {
      return next();
    }
    return res.redirect(308, '/api-docs/');
  });

  for (const { filename, source } of documents) {
    app.get(`/api-docs/${filename}`, (req, res) => {
      res.type('application/yaml').send(source);
    });
  }
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(null, {
      swaggerOptions: {
        urls: documents.map(({ filename }) => ({
          name: filename.replace('.yaml', ''),
          url: `/api-docs/${filename}`
        }))
      }
    })
  );

  app.use((req, res, next) => {
    next(new NotFoundError('Endpoint không tồn tại'));
  });
  app.use(errorHandler);

  return app;
}

const app = createApp();

module.exports = { app, createApp, loadModules };
