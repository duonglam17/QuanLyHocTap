const { ValidationError } = require('./errors');

const inputSources = ['body', 'query', 'params'];

function setRequestInput(req, source, value) {
  Object.defineProperty(req, source, {
    configurable: true,
    enumerable: true,
    writable: true,
    value
  });
}

function validate(schema) {
  if (!schema || typeof schema.safeParse !== 'function') {
    throw new TypeError('validate yêu cầu một schema có phương thức safeParse().');
  }

  return (req, res, next) => {
    const requestInput = Object.fromEntries(
      inputSources.map((source) => [source, req[source] || {}])
    );
    const structuredResult = schema.safeParse(requestInput);

    if (structuredResult.success) {
      for (const source of inputSources) {
        if (Object.hasOwn(structuredResult.data, source)) {
          setRequestInput(req, source, structuredResult.data[source]);
        }
      }
      return next();
    }

    const mergedInput = Object.assign(
      {},
      requestInput.params,
      requestInput.query,
      requestInput.body
    );
    const result = schema.safeParse(mergedInput);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
        message: issue.message
      }));
      return next(new ValidationError('Dữ liệu đầu vào không hợp lệ', details));
    }

    for (const source of inputSources) {
      const parsedSource = Object.fromEntries(
        Object.keys(requestInput[source])
          .filter((key) => Object.hasOwn(result.data, key))
          .map((key) => [key, result.data[key]])
      );
      if (Object.keys(parsedSource).length > 0) {
        setRequestInput(req, source, { ...requestInput[source], ...parsedSource });
      }
    }
    return next();
  };
}

module.exports = validate;
