const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');

const { app, createApp } = require('../src/app');

async function withServer(application, run) {
  const server = application.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));

  try {
    const address = server.address();
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test('GET /api/health returns a healthy response', async () => {
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, 'healthy');
    assert.equal(typeof body.timestamp, 'string');
    assert.equal(typeof body.uptime, 'number');
  });
});

test('automatically mounts a router from a newly added module directory', async (t) => {
  const modulesDirectory = path.resolve(__dirname, '../src/modules');
  const moduleDirectory = await fs.mkdtemp(path.join(modulesDirectory, 'temporary-module-'));
  const moduleName = path.basename(moduleDirectory);
  await fs.writeFile(
    path.join(moduleDirectory, 'index.js'),
    [
      "const { Router } = require('express');",
      'const router = Router();',
      `router.get('/ping', (req, res) => res.status(200).json({ module: '${moduleName}' }));`,
      'module.exports = router;',
      ''
    ].join('\n')
  );

  t.after(async () => {
    await fs.rm(moduleDirectory, { recursive: true, force: true });
  });

  const application = createApp(modulesDirectory);
  await withServer(application, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/${moduleName}/ping`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { module: moduleName });
  });
});
