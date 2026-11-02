const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const test = require('node:test');

const config = require('../../src/common/config');
const db = require('../../src/common/db');
const errorHandler = require('../../src/common/errorHandler');
const UserController = require('../../src/modules/m1-core/controllers/userController');
const UserRepository = require('../../src/modules/m1-core/repositories/userRepository');
const { createUserRouter } = require('../../src/modules/m1-core/routes/userRoutes');
const UserService = require('../../src/modules/m1-core/services/userService');

function createUserHarness() {
  const state = {
    users: new Map(),
    passwordHashes: [],
    nextId: 1,
    deleted: new Set(),
    listArgs: null,
    duplicate: false,
    statusUpdates: [],
    roleUpdates: [],
    softDeletes: []
  };
  const userRepository = {
    async list(args) {
      state.listArgs = args;
      return { items: [], total: 0, page: args.page, limit: args.limit };
    },
    async findById(userId) {
      return state.users.get(userId) || null;
    },
    async findUserWithPassword(userId) {
      return state.users.get(userId) || null;
    },
    async updatePassword(userId, passwordHash) {
      const user = state.users.get(userId);
      if (!user) return false;
      user.passwordHash = passwordHash;
      user.tokenVersion = (user.tokenVersion || 1) + 1;
      return true;
    },
    async create(user) {
      if (state.duplicate) {
        const error = new Error('Duplicate user');
        error.code = 'ER_DUP_ENTRY';
        throw error;
      }
      const created = {
        id: state.nextId++,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        status: 'ACTIVE',
        mustChangePassword: true,
        role: user.role
      };
      state.users.set(created.id, created);
      state.passwordHashes.push(user.passwordHash);
      return created;
    },
    async updateStatus(userId, status) {
      state.statusUpdates.push({ userId, status });
      return { id: userId, status };
    },
    async updateRole(userId, role) {
      state.roleUpdates.push({ userId, role });
      return { id: userId, role };
    },
    async softDelete(userId, deletedAt) {
      state.softDeletes.push({ userId, deletedAt });
      if (state.deleted.has(userId)) {
        return false;
      }
      state.deleted.add(userId);
      return true;
    }
  };
  const service = new UserService({
    userRepository,
    passwordHasher: {
      async hash(password, rounds) {
        return `bcrypt-${rounds}-${password}`;
      },
      async compare(password, hash) {
        return hash === `bcrypt-10-${password}` || hash === password;
      }
    },
    clock: { now: () => new Date('2026-10-22T00:00:00.000Z') },
    passwordGenerator: () => 'A1InitialPassword'
  });
  return { state, userRepository, service };
}

test('US-02 creates an active account with a hashed one-time password and required password change', async () => {
  const { state, service } = createUserHarness();
  const result = await service.createUser({
    fullName: '<b>Nguyễn Văn A</b>',
    username: 'gv_anv',
    email: 'ANV@LMS.EDU.VN',
    role: 'GIANG_VIEN'
  });

  assert.equal(result.user.fullName, 'Nguyễn Văn A');
  assert.equal(result.user.email, 'anv@lms.edu.vn');
  assert.equal(result.user.status, 'ACTIVE');
  assert.equal(result.user.mustChangePassword, true);
  assert.equal(result.user.role, 'GIANG_VIEN');
  assert.equal(result.initialPassword, 'A1InitialPassword');
  assert.deepEqual(state.passwordHashes, ['bcrypt-10-A1InitialPassword']);
  assert.equal(state.users.size, 1);
});

test('US-02 rejects invalid account data and reports duplicate username or email', async () => {
  const { state, service } = createUserHarness();

  await assert.rejects(
    service.createUser({
      fullName: '<script> </script>',
      username: 'user',
      email: 'user@example.test',
      role: 'SINH_VIEN'
    }),
    (error) => error.statusCode === 422
  );
  await assert.rejects(
    service.createUser({
      fullName: 'Student',
      username: 'student',
      email: 'invalid',
      role: 'SINH_VIEN'
    }),
    (error) => error.statusCode === 422
  );
  state.duplicate = true;
  await assert.rejects(
    service.createUser({
      fullName: 'Student',
      username: 'student',
      email: 'student@example.test',
      role: 'SINH_VIEN'
    }),
    (error) => error.statusCode === 409 && error.code === 'USER_IDENTIFIER_EXISTS'
  );
});

test('US-02 lists users with filters and bounded pagination', async () => {
  const { state, service } = createUserHarness();
  const result = await service.listUsers({
    search: '  mai  ',
    role: 'GIANG_VIEN',
    status: 'TEMPORARY_LOCKED',
    page: 3,
    limit: 25
  });

  assert.deepEqual(state.listArgs, {
    search: 'mai',
    role: 'GIANG_VIEN',
    status: 'TEMPORARY_LOCKED',
    page: 3,
    limit: 25
  });
  assert.equal(result.page, 3);
  await assert.rejects(
    service.listUsers({ page: 1, limit: 101 }),
    (error) => error.statusCode === 422
  );
});

test('US-02 prevents self-locking and supports locking and unlocking other users', async () => {
  const { state, service } = createUserHarness();

  await assert.rejects(
    service.updateUserStatus(7, 'LOCKED', 7),
    (error) => error.statusCode === 403
  );
  assert.deepEqual(state.statusUpdates, []);
  assert.deepEqual(await service.updateUserStatus(8, 'LOCKED', 7), { id: 8, status: 'LOCKED' });
  assert.deepEqual(await service.updateUserStatus(8, 'ACTIVE', 7), { id: 8, status: 'ACTIVE' });
  assert.deepEqual(state.statusUpdates, [
    { userId: 8, status: 'LOCKED' },
    { userId: 8, status: 'ACTIVE' }
  ]);
});

test('US-02 changes roles and soft-deletes without hard deletion', async () => {
  const { state, service } = createUserHarness();

  assert.deepEqual(await service.updateUserRole(8, 'ADMIN'), { id: 8, role: 'ADMIN' });
  assert.deepEqual(await service.deleteUser(8), { userId: 8, deleted: true });
  assert.deepEqual(state.softDeletes, [
    { userId: 8, deletedAt: new Date('2026-10-22T00:00:00.000Z') }
  ]);
  await assert.rejects(service.updateUserRole(0, 'ADMIN'), (error) => error.statusCode === 422);
});

test('user repository revokes sessions atomically on lock and role change, and only soft-deletes users', async () => {
  const calls = [];
  const database = { getPool: () => ({}) };
  const connection = {
    async query(sql, parameters) {
      calls.push({ sql, parameters });
      if (sql.includes('SELECT status')) {
        return [[{ status: 'ACTIVE' }], []];
      }
      if (sql.includes('SELECT role_id')) {
        return [[{ role_id: 3 }], []];
      }
      if (sql.includes('SELECT id FROM roles')) {
        return [[{ id: 2 }], []];
      }
      if (sql.includes('SELECT id')) {
        return [[{ id: 8 }], []];
      }
      if (sql.includes('SELECT u.id')) {
        return [[{ id: 8, role: 'ADMIN', status: 'LOCKED' }], []];
      }
      return [{ affectedRows: 1 }, []];
    }
  };
  const repository = new UserRepository({
    dbClient: database,
    transactionRunner: async (work) => work(connection)
  });

  await repository.updateStatus(8, 'LOCKED');
  assert.match(calls[1].sql, /token_version = token_version \+ 1/);
  assert.match(calls[2].sql, /DELETE FROM refresh_tokens WHERE user_id = \?/);
  calls.length = 0;

  await repository.updateRole(8, 'ADMIN');
  assert.match(calls[2].sql, /token_version = token_version \+ 1/);
  assert.match(calls[3].sql, /DELETE FROM refresh_tokens WHERE user_id = \?/);
  calls.length = 0;

  await repository.softDelete(8, new Date('2026-10-22T00:00:00.000Z'));
  assert.match(
    calls[1].sql,
    /UPDATE users\s+SET deleted_at = \?, token_version = token_version \+ 1/
  );
  assert.match(calls[2].sql, /DELETE FROM refresh_tokens WHERE user_id = \?/);
  assert.equal(
    calls.some(({ sql }) => /^\s*DELETE FROM users/i.test(sql)),
    false
  );
});

test('US-02 user API requires Admin role and validates the create request', async () => {
  const service = {
    async listUsers(query) {
      return { items: [], total: 0, page: query.page, limit: query.limit };
    },
    async createUser(body) {
      return {
        user: {
          id: 9,
          username: body.username,
          email: body.email,
          role: body.role,
          status: 'ACTIVE',
          mustChangePassword: true
        },
        initialPassword: 'A1InitialPassword'
      };
    }
  };
  const app = express();
  app.use(express.json());
  app.use('/api/users', createUserRouter({ userController: new UserController(service) }));
  app.use(errorHandler);
  const originalQuery = db.query;
  db.query = async () => [[{ status: 'ACTIVE', token_version: 1 }], []];
  const adminToken = jwt.sign({ user_id: 1, role: 'ADMIN', token_version: 1 }, config.JWT_SECRET);
  const studentToken = jwt.sign(
    { user_id: 2, role: 'SINH_VIEN', token_version: 1 },
    config.JWT_SECRET
  );

  try {
    const unauthenticated = await request(app).get('/api/users');
    assert.equal(unauthenticated.status, 401);

    const forbidden = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${studentToken}`);
    assert.equal(forbidden.status, 403);

    const invalid = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'Student', username: 'student', email: 'invalid', role: 'SINH_VIEN' });
    assert.equal(invalid.status, 422);

    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fullName: 'Student',
        username: 'student',
        email: 'student@example.test',
        role: 'SINH_VIEN'
      });
    assert.equal(created.status, 201);
    assert.equal(created.body.initialPassword, 'A1InitialPassword');
    assert.equal(created.body.user.status, 'ACTIVE');
  } finally {
    db.query = originalQuery;
  }
});

test('GET /api/users/me returns profile for GIANG_VIEN and SINH_VIEN, 403 for ADMIN, 401 unauthenticated', async () => {
  const { state, service } = createUserHarness();
  state.users.set(10, {
    id: 10,
    username: 'gv_mai',
    email: 'mai.nguyen@lms.edu.vn',
    fullName: 'Cô Nguyễn Thị Mai',
    role: 'GIANG_VIEN',
    status: 'ACTIVE',
    createdAt: '2026-11-01T08:00:00.000Z',
    passwordHash: 'secret_hash'
  });
  state.users.set(20, {
    id: 20,
    username: 'sv_nam',
    email: 'nam.tran@lms.edu.vn',
    fullName: 'Trần Văn Nam',
    role: 'SINH_VIEN',
    status: 'ACTIVE',
    createdAt: '2026-11-01T09:00:00.000Z',
    passwordHash: 'secret_hash'
  });

  const app = express();
  app.use(express.json());
  app.use('/api/users', createUserRouter({ userController: new UserController(service) }));
  app.use(errorHandler);

  const originalQuery = db.query;
  db.query = async () => [[{ status: 'ACTIVE', token_version: 1 }], []];

  const adminToken = jwt.sign({ user_id: 1, role: 'ADMIN', token_version: 1 }, config.JWT_SECRET);
  const teacherToken = jwt.sign(
    { user_id: 10, role: 'GIANG_VIEN', token_version: 1 },
    config.JWT_SECRET
  );
  const studentToken = jwt.sign(
    { user_id: 20, role: 'SINH_VIEN', token_version: 1 },
    config.JWT_SECRET
  );

  try {
    // 1. Chưa đăng nhập -> 401
    const unauthRes = await request(app).get('/api/users/me');
    assert.equal(unauthRes.status, 401);

    // 2. Admin gọi -> 403 kèm thông báo
    const adminRes = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(adminRes.status, 403);
    assert.equal(adminRes.body.message, 'Quản trị viên không có quyền xem trang này');

    // 3. Giảng viên gọi -> 200, trả đúng 6 trường, không lộ password/hash
    const teacherRes = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${teacherToken}`);
    assert.equal(teacherRes.status, 200);
    assert.equal(teacherRes.body.id, 10);
    assert.equal(teacherRes.body.fullName, 'Cô Nguyễn Thị Mai');
    assert.equal(teacherRes.body.username, 'gv_mai');
    assert.equal(teacherRes.body.email, 'mai.nguyen@lms.edu.vn');
    assert.equal(teacherRes.body.role, 'GIANG_VIEN');
    assert.equal(teacherRes.body.mustChangePassword, false);
    assert.equal(teacherRes.body.createdAt, '2026-11-01T08:00:00.000Z');
    assert.equal(teacherRes.body.passwordHash, undefined);
    assert.equal(teacherRes.body.password, undefined);

    // 4. Sinh viên gọi -> 200
    const studentRes = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${studentToken}`);
    assert.equal(studentRes.status, 200);
    assert.equal(studentRes.body.id, 20);
    assert.equal(studentRes.body.fullName, 'Trần Văn Nam');
    assert.equal(studentRes.body.username, 'sv_nam');
    assert.equal(studentRes.body.role, 'SINH_VIEN');
    assert.equal(studentRes.body.passwordHash, undefined);
  } finally {
    db.query = originalQuery;
  }
});

test('PUT /api/users/me/password handles change password, weak password, duplicate, wrong old password, 403 admin, 401 unauth', async () => {
  const { state, service } = createUserHarness();
  state.users.set(1, {
    id: 1,
    username: 'admin',
    email: 'admin@lms.edu.vn',
    fullName: 'Admin',
    role: 'ADMIN',
    status: 'ACTIVE',
    tokenVersion: 1,
    passwordHash: 'MatKhau@123'
  });
  state.users.set(10, {
    id: 10,
    username: 'gv_mai',
    email: 'mai.nguyen@lms.edu.vn',
    fullName: 'Cô Nguyễn Thị Mai',
    role: 'GIANG_VIEN',
    status: 'ACTIVE',
    tokenVersion: 1,
    passwordHash: 'MatKhau@123'
  });

  const app = express();
  app.use(express.json());
  app.use('/api/users', createUserRouter({ userController: new UserController(service) }));
  app.use(errorHandler);

  const originalQuery = db.query;
  db.query = async () => [[{ status: 'ACTIVE', token_version: 1 }], []];

  const adminToken = jwt.sign({ user_id: 1, role: 'ADMIN', token_version: 1 }, config.JWT_SECRET);
  const teacherToken = jwt.sign(
    { user_id: 10, role: 'GIANG_VIEN', token_version: 1 },
    config.JWT_SECRET
  );

  try {
    // 1. Chưa đăng nhập -> 401
    const unauth = await request(app).put('/api/users/me/password').send({
      currentPassword: 'MatKhau@123',
      newPassword: 'NewPassword@456'
    });
    assert.equal(unauth.status, 401);

    // 2. Admin gọi khi mustChangePassword = false -> 403
    const adminRes = await request(app)
      .put('/api/users/me/password')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ currentPassword: 'MatKhau@123', newPassword: 'NewPassword@456' });
    assert.equal(adminRes.status, 403);
    assert.equal(adminRes.body.message, 'Quản trị viên không có quyền xem trang này');

    // 2b. Admin do admin khác tạo có mustChangePassword = true -> cho phép đổi mật khẩu
    db.query = async (sql, parameters) => {
      const id = parameters[0];
      const user = state.users.get(id);
      return [
        [
          {
            status: user ? user.status : 'ACTIVE',
            token_version: user ? user.tokenVersion : 1,
            must_change_password: 1
          }
        ],
        []
      ];
    };
    const adminForcedRes = await request(app)
      .put('/api/users/me/password')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ currentPassword: 'MatKhau@123', newPassword: 'AdminNewPass@456' });
    assert.equal(adminForcedRes.status, 200);
    assert.equal(adminForcedRes.body.message, 'Đổi mật khẩu thành công');

    // Reset lại mock db.query về must_change_password = 0
    db.query = async (sql, parameters) => {
      const id = parameters[0];
      const user = state.users.get(id);
      return [
        [
          {
            status: user ? user.status : 'ACTIVE',
            token_version: user ? user.tokenVersion : 1,
            must_change_password: 0
          }
        ],
        []
      ];
    };

    // 3. Sai mật khẩu hiện tại -> 400
    const wrongCurrent = await request(app)
      .put('/api/users/me/password')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ currentPassword: 'WrongPassword123', newPassword: 'NewPassword@456' });
    assert.equal(wrongCurrent.status, 400);
    assert.match(wrongCurrent.body.message, /Mật khẩu hiện tại không đúng/);

    // 4. Mật khẩu mới yếu (< 8 ký tự hoặc thiếu số/hoa/kí tự đặc biệt) -> 400
    const weakPass = await request(app)
      .put('/api/users/me/password')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ currentPassword: 'MatKhau@123', newPassword: 'weak' });
    assert.equal(weakPass.status, 400);
    assert.match(weakPass.body.message, /tối thiểu 8 ký tự/);

    // 5. Mật khẩu mới trùng mật khẩu cũ -> 400
    const samePass = await request(app)
      .put('/api/users/me/password')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ currentPassword: 'MatKhau@123', newPassword: 'MatKhau@123' });
    assert.equal(samePass.status, 400);
    assert.match(samePass.body.message, /phải khác mật khẩu hiện tại/);

    // 6. Đổi thành công -> 200, cập nhật tokenVersion và passwordHash
    const success = await request(app)
      .put('/api/users/me/password')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ currentPassword: 'MatKhau@123', newPassword: 'NewPassword@456' });
    assert.equal(success.status, 200);
    assert.equal(success.body.message, 'Đổi mật khẩu thành công');

    const updatedUser = state.users.get(10);
    assert.equal(updatedUser.passwordHash, 'bcrypt-10-NewPassword@456');
    assert.equal(updatedUser.tokenVersion, 2);
  } finally {
    db.query = originalQuery;
  }
});
