function createClock(now = () => new Date()) {
  if (typeof now !== 'function') {
    throw new TypeError('Clock provider phải là hàm.');
  }

  return Object.freeze({
    now() {
      const value = now();
      if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
        throw new TypeError('Clock provider phải trả về Date hợp lệ.');
      }
      return new Date(value.getTime());
    },
    unixSeconds() {
      return Math.floor(this.now().getTime() / 1000);
    }
  });
}

const systemClock = createClock();

module.exports = {
  now: systemClock.now,
  unixSeconds: systemClock.unixSeconds,
  createClock
};
