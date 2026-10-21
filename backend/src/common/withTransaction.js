const db = require('./db');
const logger = require('./logger');

async function withTransaction(work, pool) {
  if (typeof work !== 'function') {
    throw new TypeError('withTransaction yêu cầu callback.');
  }

  const connection = await (pool || db.getPool()).getConnection();
  let committed = false;

  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    committed = true;
    return result;
  } catch (error) {
    if (!committed) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        logger.error('Không thể rollback transaction.', rollbackError);
      }
    }
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = withTransaction;
