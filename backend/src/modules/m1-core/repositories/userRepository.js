const db = require('../../../common/db');
const withTransaction = require('../../../common/withTransaction');
const { NotFoundError } = require('../../../common/errors');

const userColumns = `u.id, u.username, u.email, u.full_name AS fullName, u.status,
  u.must_change_password AS mustChangePassword, u.created_at AS createdAt,
  u.updated_at AS updatedAt, r.name AS role`;

function normalizeUser(user) {
  if (!user) {
    return null;
  }
  return {
    ...user,
    id: Number(user.id),
    mustChangePassword: Boolean(user.mustChangePassword)
  };
}

class UserRepository {
  constructor({ dbClient = db, transactionRunner = withTransaction } = {}) {
    this.db = dbClient;
    this.transactionRunner = transactionRunner;
  }

  async _findUser(userId, connection = this.db) {
    const [rows] = await connection.query(
      `SELECT ${userColumns}
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = ? AND u.deleted_at IS NULL
       LIMIT 1`,
      [userId]
    );
    return normalizeUser(rows[0]);
  }

  async list({ search = '', role = null, status = null, page = 1, limit = 20 } = {}) {
    const filters = ['u.deleted_at IS NULL'];
    const parameters = [];
    if (search) {
      filters.push('(u.username LIKE ? OR u.email LIKE ? OR u.full_name LIKE ?)');
      const term = `%${search}%`;
      parameters.push(term, term, term);
    }
    if (role) {
      filters.push('r.name = ?');
      parameters.push(role);
    }
    if (status) {
      filters.push('u.status = ?');
      parameters.push(status);
    }
    const whereClause = filters.join(' AND ');
    const offset = (page - 1) * limit;
    const [[countRows], [items]] = await Promise.all([
      this.db.query(
        `SELECT COUNT(*) AS total
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE ${whereClause}`,
        parameters
      ),
      this.db.query(
        `SELECT ${userColumns}
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE ${whereClause}
         ORDER BY u.created_at DESC, u.id DESC
         LIMIT ? OFFSET ?`,
        [...parameters, limit, offset]
      )
    ]);
    return {
      items: items.map(normalizeUser),
      total: Number(countRows[0]?.total || 0),
      page,
      limit
    };
  }

  async create(user) {
    return this.transactionRunner(async (connection) => {
      const [roles] = await connection.query('SELECT id FROM roles WHERE name = ? LIMIT 1', [
        user.role
      ]);
      if (!roles[0]) {
        throw new NotFoundError('Vai trò không tồn tại', { role: user.role });
      }
      const [result] = await connection.query(
        `INSERT INTO users
           (role_id, username, email, password_hash, full_name, status, must_change_password)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE', TRUE)`,
        [roles[0].id, user.username, user.email, user.passwordHash, user.fullName]
      );
      return this._findUser(result.insertId, connection);
    }, this.db.getPool());
  }

  async updateStatus(userId, status) {
    return this.transactionRunner(async (connection) => {
      const [rows] = await connection.query(
        `SELECT status
         FROM users
         WHERE id = ? AND deleted_at IS NULL
         FOR UPDATE`,
        [userId]
      );
      if (!rows[0]) {
        return null;
      }
      if (rows[0].status === status) {
        return this._findUser(userId, connection);
      }
      await connection.query(
        `UPDATE users
         SET status = ?,
             token_version = token_version + 1,
             failed_login_attempts = 0,
             failed_login_window_started_at = NULL,
             lockout_until = NULL
         WHERE id = ? AND deleted_at IS NULL`,
        [status, userId]
      );
      await connection.query('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
      return this._findUser(userId, connection);
    }, this.db.getPool());
  }

  async updateRole(userId, role) {
    return this.transactionRunner(async (connection) => {
      const [users] = await connection.query(
        `SELECT role_id
         FROM users
         WHERE id = ? AND deleted_at IS NULL
         FOR UPDATE`,
        [userId]
      );
      if (!users[0]) {
        return null;
      }
      const [roles] = await connection.query('SELECT id FROM roles WHERE name = ? LIMIT 1', [role]);
      if (!roles[0]) {
        throw new NotFoundError('Vai trò không tồn tại', { role });
      }
      if (Number(users[0].role_id) === Number(roles[0].id)) {
        return this._findUser(userId, connection);
      }
      await connection.query(
        `UPDATE users
         SET role_id = ?, token_version = token_version + 1
         WHERE id = ? AND deleted_at IS NULL`,
        [roles[0].id, userId]
      );
      await connection.query('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
      return this._findUser(userId, connection);
    }, this.db.getPool());
  }

  async softDelete(userId, deletedAt) {
    return this.transactionRunner(async (connection) => {
      const [rows] = await connection.query(
        `SELECT id
         FROM users
         WHERE id = ? AND deleted_at IS NULL
         FOR UPDATE`,
        [userId]
      );
      if (!rows[0]) {
        return false;
      }
      await connection.query(
        `UPDATE users
         SET deleted_at = ?, token_version = token_version + 1
         WHERE id = ? AND deleted_at IS NULL`,
        [deletedAt, userId]
      );
      await connection.query('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
      return true;
    }, this.db.getPool());
  }
}

module.exports = UserRepository;
