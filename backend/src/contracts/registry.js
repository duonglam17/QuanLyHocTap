function createRegistry() {
  const registered = new Map();

  return Object.freeze({
    registerPort(name, implementation) {
      if (typeof name !== 'string' || name.trim() === '') {
        throw new TypeError('Tên Port phải là chuỗi không rỗng.');
      }
      if (!implementation || typeof implementation !== 'object') {
        throw new TypeError(`Port "${name}" phải là object triển khai.`);
      }
      if (registered.has(name)) {
        throw new Error(`Port "${name}" đã được đăng ký.`);
      }
      registered.set(name, Object.freeze(implementation));
    },
    getPort(name, options = {}) {
      if (registered.has(name)) {
        return registered.get(name);
      }
      if (options.optional === true) {
        return null;
      }
      throw new Error(`Port "${name}" chưa được đăng ký.`);
    }
  });
}

const registry = createRegistry();

module.exports = {
  createRegistry,
  registerPort: registry.registerPort,
  getPort: registry.getPort
};
