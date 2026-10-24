const errorKinds = new Map([
  [400, 'bad-request'],
  [401, 'unauthorized'],
  [403, 'forbidden'],
  [404, 'not-found'],
  [413, 'payload-too-large'],
  [429, 'rate-limit'],
  [422, 'validation'],
  [500, 'server'],
  [502, 'server'],
  [503, 'server'],
  [504, 'server']
]);

export class ApiError extends Error {
  constructor({ code, details, message, status }) {
    super(message || 'Đã xảy ra lỗi khi gọi API.');
    this.name = 'ApiError';
    this.code = code ?? 'API_ERROR';
    this.details = details ?? null;
    this.status = status ?? null;
    this.kind = status >= 500 ? 'server' : (errorKinds.get(status) ?? 'network');
  }
}
