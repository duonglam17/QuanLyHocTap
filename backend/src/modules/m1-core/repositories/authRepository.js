const db = require('../../../common/db');
const withTransaction = require('../../../common/withTransaction');

class AuthRepository {
  constructor({ dbClient = db, transactionRunner = withTransaction } = {}) {
    this.db = dbClient;
    this.transactionRunner = transactionRunner;
  }

  async findByIdentifier(identifier) {
    const [rows] = await this.db.query(
      `SELECT u.id, u.username, u.email, u.password_hash, u.full_name, u.status,
              u.failed_login_attempts, u.failed_login_window_started_at, u.lockout_until,
              u.token_version, u.must_change_password, r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE (u.username = ? OR u.email = ?) AND u.deleted_at IS NULL
       LIMIT 1`,
      [identifier, identifier]
    );
    return rows[0] || null;
  }

  async findById(userId) {
    const [rows] = await this.db.query(
      `SELECT u.id, u.username, u.email, u.password_hash, u.full_name, u.status,
              u.failed_login_attempts, u.failed_login_window_started_at, u.lockout_until,
              u.token_version, u.must_change_password, r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = ? AND u.deleted_at IS NULL
       LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  }

  async releaseExpiredLockout(userId) {
    const [result] = await this.db.query(
      `UPDATE users
       SET status = 'ACTIVE',
           failed_login_attempts = 0,
           failed_login_window_started_at = NULL,
           lockout_until = NULL
       WHERE id = ?
         AND status = 'TEMPORARY_LOCKED'
         AND lockout_until IS NOT NULL
         AND lockout_until <= CURRENT_TIMESTAMP`,
      [userId]
    );
    return result.affectedRows > 0;
  }

  async recordFailedLogin(userId) {
    return this.transactionRunner(async (connection) => {
      const [rows] = await connection.query(
        `SELECT status, failed_login_attempts,
                UNIX_TIMESTAMP(failed_login_window_started_at) * 1000 AS window_started_at_ms,
                UNIX_TIMESTAMP(CURRENT_TIMESTAMP) * 1000 AS now_ms
         FROM users
         WHERE id = ? AND deleted_at IS NULL
         FOR UPDATE`,
        [userId]
      );
      const user = rows[0];
      if (!user || user.status !== 'ACTIVE') {
        return user || null;
      }

      const hasRecentFailureWindow =
        user.window_started_at_ms !== null &&
        user.window_started_at_ms !== undefined &&
        Number(user.now_ms) - Number(user.window_started_at_ms) >= 0 &&
        Number(user.now_ms) - Number(user.window_started_at_ms) < 10 * 60 * 1000;
      const failedAttempts = hasRecentFailureWindow ? Number(user.failed_login_attempts) + 1 : 1;
      const startsNewWindow = !hasRecentFailureWindow;
      const isLocked = failedAttempts >= 5;

      await connection.query(
        `UPDATE users
         SET failed_login_attempts = ?,
             failed_login_window_started_at =
               CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE failed_login_window_started_at END,
             status = CASE WHEN ? THEN 'TEMPORARY_LOCKED' ELSE status END,
             lockout_until =
               CASE WHEN ? THEN DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 15 MINUTE)
                    ELSE lockout_until END
         WHERE id = ? AND status = 'ACTIVE'`,
        [failedAttempts, startsNewWindow, isLocked, isLocked, userId]
      );

      return {
        ...user,
        status: isLocked ? 'TEMPORARY_LOCKED' : 'ACTIVE',
        failed_login_attempts: failedAttempts
      };
    }, this.db.getPool());
  }

  async createRefreshToken(userId, tokenHash, expiresAt) {
    return this.transactionRunner(async (connection) => {
      const [rows] = await connection.query(
        `SELECT u.id, u.role_id, u.status, u.token_version, u.must_change_password,
                r.name AS role
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.id = ? AND u.deleted_at IS NULL
         FOR UPDATE`,
        [userId]
      );
      const user = rows[0];
      if (!user || user.status !== 'ACTIVE') {
        return null;
      }

      await connection.query(
        `UPDATE users
         SET failed_login_attempts = 0,
             failed_login_window_started_at = NULL,
             lockout_until = NULL
         WHERE id = ?`,
        [userId]
      );
      await connection.query(
        'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
        [userId, tokenHash, expiresAt]
      );
      return user;
    }, this.db.getPool());
  }

  async rotateRefreshToken(oldTokenHash, newTokenHash, expiresAt) {
    return this.transactionRunner(async (connection) => {
      const [rows] = await connection.query(
        `SELECT rt.id AS refresh_token_id, u.id, u.role_id, u.status,
                u.token_version, u.must_change_password, r.name AS role
         FROM refresh_tokens rt
         JOIN users u ON u.id = rt.user_id
         JOIN roles r ON r.id = u.role_id
         WHERE rt.token_hash = ?
           AND rt.expires_at > CURRENT_TIMESTAMP
           AND u.status = 'ACTIVE'
           AND u.deleted_at IS NULL
         FOR UPDATE`,
        [oldTokenHash]
      );
      const user = rows[0];
      if (!user) {
        return null;
      }

      await connection.query('DELETE FROM refresh_tokens WHERE id = ?', [user.refresh_token_id]);
      await connection.query(
        'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
        [user.id, newTokenHash, expiresAt]
      );
      return user;
    }, this.db.getPool());
  }

  async revokeAllSessions(userId) {
    return this.transactionRunner(async (connection) => {
      const [result] = await connection.query(
        `UPDATE users
         SET token_version = token_version + 1
         WHERE id = ? AND deleted_at IS NULL`,
        [userId]
      );
      await connection.query('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
      return result.affectedRows > 0;
    }, this.db.getPool());
  }
}

module.exports = AuthRepository;
