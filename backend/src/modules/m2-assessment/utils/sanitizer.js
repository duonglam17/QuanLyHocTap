/**
 * LMS Mini - Module M2 Assessment
 * HTML Sanitizer Utility (BR-18: Chống Stored XSS)
 * Làm sạch chuỗi văn bản đầu vào trước khi lưu vào CSDL
 */

function sanitizeText(input) {
  if (typeof input !== 'string') {
    return input;
  }

  // 1. Loại bỏ hoàn toàn khối <script>...</script>
  let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // 2. Loại bỏ các thẻ nguy hiểm (iframe, object, embed, style, link, meta)
  sanitized = sanitized.replace(/<\/?(iframe|object|embed|style|link|meta|base|form|input)[^>]*>/gi, '');

  // 3. Loại bỏ các event handlers inline (onload, onclick, onerror, onmouseover, v.v.)
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*(['"]).*?\1/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^>\s]+/gi, '');

  // 4. Loại bỏ protocol javascript:
  sanitized = sanitized.replace(/javascript\s*:/gi, '');

  return sanitized.trim();
}

module.exports = {
  sanitizeText
};

