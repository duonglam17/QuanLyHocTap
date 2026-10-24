export function mockAuth(role = 'SINH_VIEN', overrides = {}) {
  return {
    user: {
      id: 1,
      fullName: 'Người dùng mẫu',
      username: 'nguoi_dung',
      role
    },
    status: 'authenticated',
    login: async () => undefined,
    logout: async () => undefined,
    hasRole: (...roles) => roles.includes(role),
    ...overrides
  };
}
