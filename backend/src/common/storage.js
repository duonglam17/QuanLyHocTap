const crypto = require('crypto');
const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const FileType = require('file-type');
const config = require('./config');
const { BadRequestError } = require('./errors');

const mimeByExtension = new Map([
  ['.pdf', { detected: 'application/pdf', reported: 'application/pdf' }],
  [
    '.docx',
    {
      detected: 'application/zip',
      aliases: ['application/x-zip-compressed'],
      reported: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }
  ],
  [
    '.pptx',
    {
      detected: 'application/zip',
      aliases: ['application/x-zip-compressed'],
      reported: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    }
  ],
  [
    '.zip',
    {
      detected: 'application/zip',
      aliases: ['application/x-zip-compressed'],
      reported: 'application/zip'
    }
  ],
  [
    '.rar',
    {
      detected: 'application/vnd.rar',
      aliases: ['application/x-rar-compressed'],
      reported: 'application/vnd.rar'
    }
  ]
]);

const uuidFilename =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[a-z0-9]+$/i;

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  );
}

function validateStoragePath(baseDirectory, destinationDirectory) {
  const backendRoot = path.resolve(__dirname, '../..');
  const sourceDirectory = path.join(backendRoot, 'src');
  const webRoot = path.join(backendRoot, 'public');

  if (isInside(sourceDirectory, baseDirectory) || isInside(webRoot, baseDirectory)) {
    throw new Error('UPLOAD_DIR phải nằm ngoài mã nguồn và web root.');
  }
  if (!isInside(baseDirectory, destinationDirectory)) {
    throw new BadRequestError('Thư mục lưu trữ không hợp lệ');
  }
}

function safeOriginalName(originalName) {
  if (typeof originalName !== 'string' || originalName.length === 0) {
    throw new BadRequestError('Tên tệp không hợp lệ');
  }

  const normalized = Array.from(path.basename(originalName.replace(/\\/g, '/')))
    .filter((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint > 0x1f && codePoint !== 0x7f;
    })
    .join('');
  if (!normalized || normalized.length > 255) {
    throw new BadRequestError('Tên tệp không hợp lệ');
  }
  return normalized;
}

function normalizeExtensions(allowedExt) {
  if (!Array.isArray(allowedExt) || allowedExt.length === 0) {
    throw new TypeError('allowedExt phải là mảng phần mở rộng được phép.');
  }
  return new Set(
    allowedExt.map((extension) => {
      if (typeof extension !== 'string' || extension.trim() === '') {
        throw new TypeError('Phần mở rộng phải là chuỗi không rỗng.');
      }
      const normalized = extension.startsWith('.') ? extension : `.${extension}`;
      return normalized.toLowerCase();
    })
  );
}

function normalizeMimeTypes(allowedMime) {
  if (!Array.isArray(allowedMime) || allowedMime.length === 0) {
    throw new TypeError('allowedMime phải là mảng MIME type được phép.');
  }
  return new Set(allowedMime);
}

function resolveStoredPath(storedName, baseDirectory = config.UPLOAD_DIR) {
  if (typeof storedName !== 'string' || !uuidFilename.test(storedName)) {
    throw new BadRequestError('Tên tệp lưu trữ không hợp lệ');
  }
  const root = path.resolve(baseDirectory);
  const filePath = path.resolve(root, storedName);
  validateStoragePath(root, filePath);
  return filePath;
}

async function saveUpload(file, { allowedExt, allowedMime, maxBytes } = {}) {
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw new BadRequestError('Tệp tải lên rỗng hoặc không hợp lệ');
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new TypeError('maxBytes phải là số nguyên dương.');
  }
  if (file.buffer.length > maxBytes) {
    throw new BadRequestError('Dung lượng tệp vượt quá giới hạn', {
      maxBytes,
      size: file.buffer.length
    });
  }

  const extensions = normalizeExtensions(allowedExt);
  const mimeTypes = normalizeMimeTypes(allowedMime);
  const originalName = safeOriginalName(file.originalname || file.originalName);
  const extension = path.extname(originalName).toLowerCase();
  if (!extensions.has(extension)) {
    throw new BadRequestError('Loại định dạng tệp không được hỗ trợ');
  }

  const detected = await FileType.fromBuffer(file.buffer);
  const expectedMime = mimeByExtension.get(extension);
  const acceptedMagicTypes = new Set([expectedMime?.detected, ...(expectedMime?.aliases || [])]);
  if (!detected || !acceptedMagicTypes.has(detected.mime)) {
    throw new BadRequestError('Nội dung tệp không khớp với phần mở rộng');
  }
  if (!mimeTypes.has(detected.mime) && !mimeTypes.has(expectedMime.reported)) {
    throw new BadRequestError('MIME type của tệp không được hỗ trợ');
  }

  const directory = path.resolve(config.UPLOAD_DIR);
  validateStoragePath(directory, directory);
  const storedName = `${crypto.randomUUID()}${extension}`;
  const destination = path.join(directory, storedName);
  const temporary = `${destination}.tmp`;
  let temporaryCreated = false;
  let destinationCreated = false;

  try {
    await fsPromises.mkdir(directory, { recursive: true });
    temporaryCreated = true;
    await fsPromises.writeFile(temporary, file.buffer, { flag: 'wx', mode: 0o600 });
    await fsPromises.rename(temporary, destination);
    temporaryCreated = false;
    destinationCreated = true;

    return {
      storedName,
      originalName,
      mime: mimeTypes.has(expectedMime.reported) ? expectedMime.reported : detected.mime,
      size: file.buffer.length
    };
  } catch (error) {
    const cleanupErrors = [];
    for (const [filePath, shouldRemove] of [
      [temporary, temporaryCreated],
      [destination, destinationCreated]
    ]) {
      if (shouldRemove) {
        try {
          await fsPromises.rm(filePath, { force: true });
        } catch (cleanupError) {
          cleanupErrors.push(cleanupError);
        }
      }
    }
    if (cleanupErrors.length > 0) {
      throw new AggregateError([error, ...cleanupErrors], 'Không thể dọn tệp sau lỗi lưu trữ.', {
        cause: error
      });
    }
    throw error;
  }
}

function openReadStream(storedName) {
  return fs.createReadStream(resolveStoredPath(storedName));
}

async function deleteFile(storedName) {
  await fsPromises.rm(resolveStoredPath(storedName), { force: true });
}

module.exports = { saveUpload, openReadStream, deleteFile };
