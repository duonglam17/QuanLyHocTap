const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const request = require('supertest');
const test = require('node:test');

const config = require('../../src/common/config');
const db = require('../../src/common/db');
const errorHandler = require('../../src/common/errorHandler');
const AuthController = require('../../src/modules/m1-core/controllers/authController');
const AuthRepository = require('../../src/modules/m1-core/repositories/authRepository');
const AuthService = require('../../src/modules/m1-core/services/authService');
const { createAuthRouter } = require('../../src/modules/m1-core/routes/authRoutes');

function createClock(initialDate = new Date('2026-10-21T12:00:00.000Z')) {
  let currentDate = new Date(initialDate);
  return {
    now() {
      return new Date(currentDate);
    },
    advance(milliseconds) {
      currentDate = new Date(currentDate.getTime() + milliseconds);
    }
  };
}

function createAuthState({ clock, user, correctPassword }) {
  const state = {
    user: {
      id: 41,
      username: 'student',
      email: 'student@example.test',
      password_hash: correctPassword,
      full_name: 'Test Student',
      role: 'SINH_VIEN',
      status: 'ACTIVE',
      token_version: 3,
      must_change_password: true,
      failed_login_attempts: 0,
      failed_login_window_started_at: null,
      lockout_until: null,
      ...user
    },
    refreshTokens: new Map()
  };

  return {
    state,
    repository: {
      async findByIdentifier(identifier) {
        return identifier === state.user.username || identifier === state.user.email
          ? { ...state.user }
          : null;
      },
      async findById(userId) {
        return Number(userId) === Number(state.user.id) ? { ...state.user } : null;
      },
      async releaseExpiredLockout() {
        const until = state.user.lockout_until ? new Date(state.user.lockout_until) : null;
        if (
          state.user.status === 'TEMPORARY_LOCKED' &&
          until &&
          until.getTime() <= clock.now().getTime()
        ) {
          state.user.status = 'ACTIVE';
          state.user.failed_login_attempts = 0;
          state.user.failed_login_window_started_at = null;
          state.user.lockout_until = null;
          return true;
        }
        return false;
      },
      async recordFailedLogin() {
        const now = clock.now();
        const windowStartedAt = state.user.failed_login_window_started_at;
        const withinWindow =
          windowStartedAt && now.getTime() - new Date(windowStartedAt).getTime() < 10 * 60_000;
        state.user.failed_login_attempts = withinWindow ? state.user.failed_login_attempts + 1 : 1;
        if (!withinWindow) {
          state.user.failed_login_window_started_at = now;
        }
        if (state.user.failed_login_attempts >= 5) {
          state.user.status = 'TEMPORARY_LOCKED';
          state.user.lockout_until = new Date(now.getTime() + 15 * 60_000);
        }
        return { status: state.user.status };
      },
      async createRefreshToken(userId, tokenHash) {
        if (state.user.status !== 'ACTIVE' || Number(userId) !== Number(state.user.id)) {
          return null;
        }
        state.user.failed_login_attempts = 0;
        state.user.failed_login_window_started_at = null;
        state.user.lockout_until = null;
        state.refreshTokens.set(tokenHash, Number(userId));
        return { ...state.user };
      },
      async rotateRefreshToken(oldHash, newHash) {
        const userId = state.refreshTokens.get(oldHash);
        if (
          userId === undefined ||
          Number(userId) !== Number(state.user.id) ||
          state.user.status !== 'ACTIVE'
        ) {
          return null;
        }
        state.refreshTokens.delete(oldHash);
        state.refreshTokens.set(newHash, userId);
        return { ...state.user };
      },
      async revokeAllSessions(userId) {
        if (Number(userId) !== Number(state.user.id)) {
          return false;
        }
        state.user.token_version += 1;
        state.refreshTokens.clear();
        return true;
      }
    }
  };
}

function createAuthApp(authService) {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter({ authController: new AuthController(authService) }));
  app.use(errorHandler);
  return app;
}

test('login, refresh rotation, consistent credentials errors, and IP rate limiting work', async () => {
  const passwordHash = await bcrypt.hash('Password123', 10);
  const clock = createClock();
  const { state, repository } = createAuthState({ clock, correctPassword: passwordHash });
  const service = new AuthService({
    authRepository: repository,
    clock,
    config,
    tokenFactory: (() => {
      let sequence = 0;
      return () => `refresh-token-${++sequence}`;
    })()
  });
  const app = createAuthApp(service);

  const login = await request(app)
    .post('/api/auth/login')
    .send({ username: state.user.email, password: 'Password123' });
  assert.equal(login.status, 200);
  assert.deepEqual(login.body.user, {
    id: 41,
    role: 'SINH_VIEN',
    must_change_password: true
  });
  const accessPayload = jwt.verify(login.body.accessToken, config.JWT_SECRET);
  assert.equal(accessPayload.user_id, 41);
  assert.equal(accessPayload.role, 'SINH_VIEN');
  assert.equal(accessPayload.token_version, 3);
  assert.equal(accessPayload.exp - accessPayload.iat, 15 * 60);
  assert.equal(state.refreshTokens.size, 1);
  assert.equal(state.refreshTokens.has(login.body.refreshToken), false);

  const refreshed = await request(app)
    .post('/api/auth/refresh')
    .send({ refreshToken: login.body.refreshToken });
  assert.equal(refreshed.status, 200);
  assert.notEqual(refreshed.body.refreshToken, login.body.refreshToken);
  assert.equal(state.refreshTokens.size, 1);
  const replay = await request(app)
    .post('/api/auth/refresh')
    .send({ refreshToken: login.body.refreshToken });
  assert.equal(replay.status, 401);

  const wrongPassword = await request(app)
    .post('/api/auth/login')
    .send({ username: 'student', password: 'Wrong123' });
  const unknownUser = await request(app)
    .post('/api/auth/login')
    .send({ username: 'missing', password: 'Wrong123' });
  assert.equal(wrongPassword.status, 401);
  assert.equal(unknownUser.status, 401);
  assert.equal(wrongPassword.body.message, unknownUser.body.message);

  const missingCredentials = await request(app).post('/api/auth/login').send({ username: '' });
  assert.equal(missingCredentials.status, 400);
  assert.equal(missingCredentials.body.message, 'Vui lòng nhập đầy đủ thông tin đăng nhập');

  state.user.status = 'LOCKED';
  const locked = await request(app)
    .post('/api/auth/login')
    .send({ username: 'student', password: 'Password123' });
  assert.equal(locked.status, 403);
  const rateLimited = await request(app)
    .post('/api/auth/login')
    .send({ username: 'student', password: 'Password123' });
  assert.equal(rateLimited.status, 429);
});

test('five failures in ten minutes lock temporarily, then allow login after expiry', async () => {
  const clock = createClock();
  const passwordHash = await bcrypt.hash('Password123', 10);
  const { state, repository } = createAuthState({ clock, correctPassword: passwordHash });
  const service = new AuthService({ authRepository: repository, clock, config });

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await assert.rejects(
      service.login({ username: 'student', password: 'Wrong123' }),
      (error) => error.statusCode === 401
    );
  }
  await assert.rejects(
    service.login({ username: 'student', password: 'Wrong123' }),
    (error) => error.statusCode === 403
  );
  assert.equal(state.user.status, 'TEMPORARY_LOCKED');

  await assert.rejects(
    service.login({ username: 'student', password: 'Password123' }),
    (error) => error.statusCode === 403
  );
  clock.advance(15 * 60_000);
  const result = await service.login({ username: 'student', password: 'Password123' });
  assert.ok(result.accessToken);
  assert.equal(state.user.status, 'ACTIVE');
  assert.equal(state.user.failed_login_attempts, 0);
});

test('failed login attempts outside the ten-minute window restart the counter', async () => {
  const clock = createClock();
  const passwordHash = await bcrypt.hash('Password123', 10);
  const { state, repository } = createAuthState({ clock, correctPassword: passwordHash });
  const service = new AuthService({ authRepository: repository, clock, config });

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await assert.rejects(
      service.login({ username: 'student', password: 'Wrong123' }),
      (error) => error.statusCode === 401
    );
  }
  clock.advance(10 * 60_000 + 1);
  await assert.rejects(
    service.login({ username: 'student', password: 'Wrong123' }),
    (error) => error.statusCode === 401
  );
  assert.equal(state.user.failed_login_attempts, 1);
  assert.equal(state.user.status, 'ACTIVE');
});

test('repository updates the locked failure counter atomically in a transaction', async () => {
  let updateParameters;
  const database = {
    getPool: () => ({}),
    query: async () => {
      throw new Error('The repository should use the transaction connection.');
    }
  };
  const repository = new AuthRepository({
    dbClient: database,
    transactionRunner: async (work) =>
      work({
        async query(sql, parameters) {
          if (sql.includes('SELECT status, failed_login_attempts')) {
            return [
              [
                {
                  status: 'ACTIVE',
                  failed_login_attempts: 4,
                  window_started_at_ms: 1_798_000_000_000,
                  now_ms: 1_798_000_100_000
                }
              ],
              []
            ];
          }
          updateParameters = parameters;
          return [{ affectedRows: 1 }, []];
        }
      })
  });

  const result = await repository.recordFailedLogin(41);
  assert.equal(result.status, 'TEMPORARY_LOCKED');
  assert.deepEqual(updateParameters, [5, false, true, true, 41]);
});

test('logout revokes refresh tokens and invalidates existing access tokens', async () => {
  const passwordHash = await bcrypt.hash('Password123', 10);
  const clock = createClock();
  const { state, repository } = createAuthState({ clock, correctPassword: passwordHash });
  const service = new AuthService({ authRepository: repository, clock, config });
  const app = createAuthApp(service);
  const originalQuery = db.query;
  db.query = async () => [[{ status: 'ACTIVE', token_version: state.user.token_version }], []];
  const accessToken = jwt.sign(
    { user_id: state.user.id, role: state.user.role, token_version: state.user.token_version },
    config.JWT_SECRET,
    { expiresIn: '15m' }
  );

  try {
    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);
    assert.equal(logout.status, 204);
    assert.equal(state.user.token_version, 4);
    assert.equal(state.refreshTokens.size, 0);

    const staleAccessToken = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);
    assert.equal(staleAccessToken.status, 401);
  } finally {
    db.query = originalQuery;
  }
});
