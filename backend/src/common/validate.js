const { ValidationError } = require('./errors');

function validate(schema, source = 'body') {
  if (!schema || typeof schema.safeParse !== 'function') {
    throw new TypeError('validate yêu cầu một schema có phương thức safeParse().');
  }
  if (!['body', 'params', 'query'].includes(source)) {
    throw new TypeError('source phải là body, params hoặc query.');
  }

  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
        message: issue.message
      }));
      return next(new ValidationError('Dữ liệu đầu vào không hợp lệ', details));
    }

    req[source] = result.data;
    return next();
  };
}

module.exports = validate;
