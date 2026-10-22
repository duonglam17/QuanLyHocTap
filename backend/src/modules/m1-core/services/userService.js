const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError
} = require('../../../common/errors');
const { clock: defaultClock } = require('../../../common');
const sanitizeText = require('../../../common/sanitizeText');

const roles = new Set(['ADMIN', 'GIANG_VIEN', 'SINH_VIEN']);
const accountStatuses = new Set(['ACTIVE', 'LOCKED']);
const searchableStatuses = new Set(['ACTIVE', 'LOCKED', 'TEMPORARY_LOCKED']);

function isDuplicateEntry(error) {
  return error?.code === 'ER_DUP_ENTRY' || error?.errno === 1062;
}

function validId(value) {
  return Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

class UserService {
  constructor({
    userRepository,
    passwordHasher = bcrypt,
    clock = defaultClock,
    passwordGenerator = () => `A1${crypto.randomBytes(16).toString('base64url')}`
  } = {}) {
    this.userRepository = userRepository;
    this.passwordHasher = passwordHasher;
    this.clock = clock;
    this.passwordGenerator = passwordGenerator;
  }

  _validateUserId(userId) {
    if (!validId(userId)) {
      throw new ValidationError('Mã người dùng không hợp lệ');
    }
    return Number(userId);
  }

  _validateRole(role) {
    if (typeof role !== 'string' || !roles.has(role)) {
      throw new ValidationError('Vai trò phải là ADMIN, GIANG_VIEN hoặc SINH_VIEN');
    }
  }

  async listUsers({ search = '', role, status, page = 1, limit = 20 } = {}) {
    if (typeof search !== 'string' || search.length > 100) {
      throw new ValidationError('Từ khóa tìm kiếm tối đa 100 ký tự');
    }
    if (role !== undefined) {
      this._validateRole(role);
    }
    if (status !== undefined && !searchableStatuses.has(status)) {
      throw new ValidationError('Trạng thái tài khoản không hợp lệ');
    }
    if (!Number.isSafeInteger(Number(page)) || Number(page) < 1) {
      throw new ValidationError('Số trang phải là số nguyên dương');
    }
    if (!Number.isSafeInteger(Number(limit)) || Number(limit) < 1 || Number(limit) > 100) {
      throw new ValidationError('Số lượng mỗi trang phải từ 1 đến 100');
    }
    return this.userRepository.list({
      search: search.trim(),
      role,
      status,
      page: Number(page),
      limit: Number(limit)
    });
  }

  async createUser(input = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new ValidationError('Thông tin tài khoản không hợp lệ');
    }
    const fullName = typeof input.fullName === 'string' ? sanitizeText(input.fullName.trim()) : '';
    const username = typeof input.username === 'string' ? input.username.trim() : '';
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    this._validateRole(input.role);
    if (!fullName || fullName.length > 100) {
      throw new ValidationError('Họ tên phải từ 1 đến 100 ký tự');
    }
    if (!username || username.length > 50) {
      throw new ValidationError('Tên đăng nhập phải từ 1 đến 50 ký tự');
    }
    if (!email || email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ValidationError('Email không hợp lệ');
    }
    const initialPassword = this.passwordGenerator();
    if (
      typeof initialPassword !== 'string' ||
      initialPassword.length < 8 ||
      !/[A-Za-z]/.test(initialPassword) ||
      !/\d/.test(initialPassword)
    ) {
      throw new TypeError(
        'Bộ sinh mật khẩu phải tạo mật khẩu có chữ cái và chữ số, tối thiểu 8 ký tự.'
      );
    }
    const passwordHash = await this.passwordHasher.hash(initialPassword, 10);
    try {
      const user = await this.userRepository.create({
        fullName,
        username,
        email,
        role: input.role,
        passwordHash
      });
      return { user, initialPassword };
    } catch (error) {
      if (isDuplicateEntry(error)) {
        throw new ConflictError(
          'Tên đăng nhập hoặc email đã được sử dụng',
          null,
          'USER_IDENTIFIER_EXISTS'
        );
      }
      throw error;
    }
  }

  async updateUserStatus(userId, status, actorId) {
    const id = this._validateUserId(userId);
    if (!accountStatuses.has(status)) {
      throw new ValidationError('Trạng thái phải là ACTIVE hoặc LOCKED');
    }
    if (status === 'LOCKED' && Number(id) === Number(actorId)) {
      throw new ForbiddenError('Bạn không thể tự khóa tài khoản của mình');
    }
    const user = await this.userRepository.updateStatus(id, status);
    if (!user) {
      throw new NotFoundError('Không tìm thấy tài khoản');
    }
    return user;
  }

  async updateUserRole(userId, role) {
    const id = this._validateUserId(userId);
    this._validateRole(role);
    const user = await this.userRepository.updateRole(id, role);
    if (!user) {
      throw new NotFoundError('Không tìm thấy tài khoản');
    }
    return user;
  }

  async deleteUser(userId) {
    const id = this._validateUserId(userId);
    const deleted = await this.userRepository.softDelete(id, this.clock.now());
    if (!deleted) {
      throw new NotFoundError('Không tìm thấy tài khoản');
    }
    return { userId: id, deleted: true };
  }
}

module.exports = UserService;
