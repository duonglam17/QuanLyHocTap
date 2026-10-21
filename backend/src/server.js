const { app } = require('./app');
const env = require('./common/env');
const logger = require('./common/logger');

function startServer() {
  const server = app.listen(env.PORT, () => {
    logger.info(`LMS Mini backend đang lắng nghe tại cổng ${env.PORT}`);
  });

  const shutdown = (signal) => {
    logger.info(`Nhận ${signal}, đang đóng HTTP server`);
    server.close((error) => {
      if (error) {
        logger.error('Không thể đóng HTTP server sạch sẽ:', error);
        process.exitCode = 1;
      }
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
