const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const request = require('supertest');
const test = require('node:test');

const { app, createApp } = require('../src/app');

test('GET /api/health returns a healthy response', async () => {
  const response = await request(app).get('/api/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'healthy');
  assert.equal(typeof response.body.timestamp, 'string');
  assert.equal(typeof response.body.uptime, 'number');
});

test('automatically mounts modules at /api and preserves each legacy ping path', async () => {
  const modulePaths = ['/api/m1-core/ping', '/api/m2-assessment/ping', '/api/m3-quiz/ping'];

  for (const modulePath of modulePaths) {
    const response = await request(app).get(modulePath);
    assert.equal(response.status, 200, modulePath);
    assert.equal(response.body.status, 'ok');
  }
});

test('discovers routes and calls init(ctx) for a newly added module', async (t) => {
  const modulesDirectory = path.resolve(__dirname, '../src/modules');
  const moduleDirectory = await fs.mkdtemp(path.join(modulesDirectory, 'temporary-module-'));
  const moduleName = path.basename(moduleDirectory);
  await fs.writeFile(
    path.join(moduleDirectory, 'index.js'),
    [
      "const { Router } = require('express');",
      'const router = Router();',
      'let initialized = false;',
      "router.get('/discovered', (req, res) => res.status(200).json({ route: 'discovered' }));",
      "router.get('/initialized', (req, res) => res.json({ initialized }));",
      `router.get('/ping', (req, res) => res.status(200).json({ status: 'ok', module: ${JSON.stringify(moduleName)} }));`,
      'module.exports = {',
      '  router,',
      '  init(ctx) {',
      "    if (!ctx.common || !ctx.contracts) throw new Error('Missing module context');",
      '    initialized = true;',
      '  }',
      '};',
      ''
    ].join('\n')
  );

  t.after(async () => {
    await fs.rm(moduleDirectory, { recursive: true, force: true });
  });

  const application = createApp(modulesDirectory);
  const discoveredRoute = await request(application).get('/api/discovered');
  const initializedRoute = await request(application).get('/api/initialized');
  const legacyPing = await request(application).get(`/api/${moduleName}/ping`);

  assert.equal(discoveredRoute.status, 200);
  assert.deepEqual(discoveredRoute.body, { route: 'discovered' });
  assert.deepEqual(initializedRoute.body, { initialized: true });
  assert.equal(legacyPing.status, 200);
  assert.equal(legacyPing.body.module, moduleName);
});

test('fails startup when modules declare the same HTTP method and path', async (t) => {
  const modulesDirectory = path.resolve(__dirname, '../src/modules');
  const collisionDirectory = await fs.mkdtemp(path.join(modulesDirectory, 'collision-test-'));
  const moduleNames = ['module-a', 'module-b'];

  await Promise.all(
    moduleNames.map(async (moduleName) => {
      const moduleDirectory = path.join(collisionDirectory, moduleName);
      await fs.mkdir(moduleDirectory);
      await fs.writeFile(
        path.join(moduleDirectory, 'index.js'),
        moduleName === 'module-a'
          ? [
              "const { Router } = require('express');",
              'const router = Router();',
              'const nested = Router();',
              "nested.get('/collision', (req, res) => res.sendStatus(200));",
              "router.use('/prefix', nested);",
              'module.exports = router;',
              ''
            ].join('\n')
          : [
              "const { Router } = require('express');",
              'const router = Router();',
              "router.get('/prefix/collision', (req, res) => res.sendStatus(200));",
              'module.exports = router;',
              ''
            ].join('\n')
      );
    })
  );

  t.after(async () => {
    await fs.rm(collisionDirectory, { recursive: true, force: true });
  });

  assert.throws(() => createApp(collisionDirectory), /Trùng route GET \/api\/prefix\/collision/);
});

test('Swagger UI and all module specifications are served', async () => {
  const redirect = await request(app).get('/api-docs');
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.location, '/api-docs/');

  const ui = await request(app).get('/api-docs/');
  assert.equal(ui.status, 200);
  assert.match(ui.text, /Swagger UI/);
  assert.match(ui.headers['content-security-policy'], /script-src 'self' 'unsafe-inline'/);

  const uiConfig = await request(app).get('/api-docs/swagger-ui-init.js');
  assert.equal(uiConfig.status, 200);
  assert.match(uiConfig.text, /\/api-docs\/m1\.yaml/);
  assert.match(uiConfig.text, /\/api-docs\/m2\.yaml/);
  assert.match(uiConfig.text, /\/api-docs\/m3\.yaml/);

  for (const document of ['common.yaml', 'm1.yaml', 'm2.yaml', 'm3.yaml']) {
    const response = await request(app).get(`/api-docs/${document}`);
    assert.equal(response.status, 200, document);
    assert.match(response.text, /openapi: 3\.0\.3/);
  }
});
