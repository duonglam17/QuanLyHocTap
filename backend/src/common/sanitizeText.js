const sanitizeHtml = require('sanitize-html');

function sanitizeText(value, options = {}) {
  if (typeof value !== 'string') {
    throw new TypeError('sanitizeText chỉ nhận chuỗi.');
  }

  return sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {},
    ...options
  });
}

module.exports = sanitizeText;
