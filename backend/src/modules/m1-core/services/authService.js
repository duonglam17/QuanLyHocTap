const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { BadRequestError, ForbiddenError, UnauthorizedError } = require('../../../common/errors');
const { clock: defaultClock, config: defaultConfig } = require('../../../common');

const invalidCredentialsMessage = 'Tên đăng nhập hoặc mật khẩu không đúng';
const refreshTokenMessage = 'Refresh token không hợp lệ hoặc đã hết hạn';

function parseDurationMs(value) {
  const match = /^([1-9]\d*)(s|m|h|d)$/.exec(value);
  if (!match) {
    throw new TypeError('REFRESH_TOKEN_EXPIRES_IN phải có dạng số kèm s, m, h hoặc d.');
  }
  const units = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return Number(match[1]) * units[match[2]];
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

class AuthService {
  constructor({
    authRepository,
    passwordHasher = bcrypt,
    tokenSigner = jwt,
    clock = defaultClock,
    config = defaultConfig,
    tokenFactory = () => crypto.randomBytes(32).toString('hex')
  } = {}) {
    this.authRepository = authRepository;
    this.passwordHasher = passwordHasher;
    this.tokenSigner = tokenSigner;
    this.clock = clock;
    this.config = config;
    this.refreshTokenTtlMs = parseDurationMs(config.REFRESH_TOKEN_EXPIRES_IN);
    this.tokenFactory = tokenFactory;
    this.recentRotations = new Map();
  }

  _createAccessToken(user) {
    return this.tokenSigner.sign(
      {
        user_id: user.id,
        role: user.role,
        token_version: Number(user.token_version)
      },
      this.config.JWT_SECRET,
      { expiresIn: this.config.JWT_EXPIRES_IN }
    );
  }

  _createTokenResponse(user, refreshToken) {
    return {
      accessToken: this._createAccessToken(user),
      refreshToken,
      user: {
        id: user.id,
        role: user.role,
        must_change_password: Boolean(user.must_change_password)
      }
    };
  }

  _newRefreshTokenExpiry() {
    return new Date(this.clock.now().getTime() + this.refreshTokenTtlMs);
  }

  async login({ username, password } = {}) {
    if (
      typeof username !== 'string' ||
      !username.trim() ||
      typeof password !== 'string' ||
      !password
    ) {
      throw new BadRequestError('Vui lòng nhập đầy đủ thông tin đăng nhập');
    }

    const identifier = username.trim();
    let user = await this.authRepository.findByIdentifier(identifier);
    if (!user) {
      throw new UnauthorizedError(invalidCredentialsMessage);
    }

    if (user.status === 'LOCKED') {
      throw new ForbiddenError('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin');
    }

    if (user.status === 'TEMPORARY_LOCKED') {
      await this.authRepository.releaseExpiredLockout(user.id);
      user = await this.authRepository.findById(user.id);
      if (user?.status === 'TEMPORARY_LOCKED') {
        throw new ForbiddenError('Tài khoản bị tạm khóa 15 phút do nhập sai quá 5 lần', {
          lockoutUntil: user.lockout_until
        });
      }
    }

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedError(invalidCredentialsMessage);
    }

    const passwordMatches = await this.passwordHasher.compare(password, user.password_hash);
    if (!passwordMatches) {
      const failure = await this.authRepository.recordFailedLogin(user.id);
      if (failure?.status === 'TEMPORARY_LOCKED') {
        throw new ForbiddenError('Tài khoản bị tạm khóa 15 phút do nhập sai quá 5 lần');
      }
      throw new UnauthorizedError(invalidCredentialsMessage);
    }

    const refreshToken = this.tokenFactory();
    const currentUser = await this.authRepository.createRefreshToken(
      user.id,
      hashToken(refreshToken),
      this._newRefreshTokenExpiry()
    );
    if (!currentUser) {
      throw new ForbiddenError('Tài khoản không hoạt động');
    }
    return this._createTokenResponse(currentUser, refreshToken);
  }

  async refresh({ refreshToken } = {}) {
    if (typeof refreshToken !== 'string' || !refreshToken) {
      throw new BadRequestError('Refresh token là bắt buộc');
    }

    const tokenHash = hashToken(refreshToken);
    if (!this.inFlightRefreshes) {
      this.inFlightRefreshes = new Map();
    }
    const pending = this.inFlightRefreshes.get(tokenHash);
    if (pending) {
      return pending;
    }

    const executeRefresh = async () => {
      const nextRefreshToken = this.tokenFactory();
      const nextTokenHash = hashToken(nextRefreshToken);
      const user = await this.authRepository.rotateRefreshToken(
        tokenHash,
        nextTokenHash,
        this._newRefreshTokenExpiry()
      );
      if (!user) {
        throw new UnauthorizedError(refreshTokenMessage);
      }

      return this._createTokenResponse(user, nextRefreshToken);
    };

    const task = executeRefresh();
    this.inFlightRefreshes.set(tokenHash, task);
    try {
      return await task;
    } finally {
      this.inFlightRefreshes.delete(tokenHash);
    }
  }

  async logout(userId) {
    const revoked = await this.authRepository.revokeAllSessions(userId);
    if (!revoked) {
      throw new UnauthorizedError('Phiên đăng nhập không còn hợp lệ');
    }
  }
}

module.exports = AuthService;
