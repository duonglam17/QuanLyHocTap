const cors = require('cors');
const express = require('express');
const fs = require('fs');
const path = require('path');

const env = require('./common/env');
const errorHandler = require('./common/errorHandler');
const { NotFoundError } = require('./common/errors');
const logger = require('./common/logger');

const modulesDirectory = path.join(__dirname, 'modules');

function loadModules(app, directory) {
  const moduleDirectories = fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of moduleDirectories) {
    const moduleEntry = path.join(directory, entry.name, 'index.js');
    if (!fs.existsSync(moduleEntry)) {
      continue;
    }

    const router = require(moduleEntry);
    if (typeof router !== 'function') {
      throw new TypeError(`Module "${entry.name}" must export an Express router.`);
    }

    app.use(`/api/${entry.name}`, router);
    logger.info(`Đã nạp module "${entry.name}" tại /api/${entry.name}`);
  }
}

function createApp(directory = modulesDirectory) {
  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  loadModules(app, directory);

  app.use((req, res, next) => {
    next(new NotFoundError('Endpoint không tồn tại'));
  });
  app.use(errorHandler);

  return app;
}

const app = createApp();

module.exports = { app, createApp };
