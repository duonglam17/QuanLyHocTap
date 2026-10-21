const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const FileType = require('file-type');
const config = require('./config');
const { ValidationError } = require('./errors');

const extensions = new Map([
  ['.pdf', new Set(['application/pdf'])],
  ['.docx', new Set(['application/zip', 'application/x-zip-compressed'])],
  ['.pptx', new Set(['application/zip', 'application/x-zip-compressed'])],
  ['.zip', new Set(['application/zip', 'application/x-zip-compressed'])],
  ['.rar', new Set(['application/x-rar-compressed', 'application/vnd.rar'])]
]);

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
    throw new ValidationError('Thư mục lưu trữ không hợp lệ');
  }
}

function getSafeOriginalName(originalName) {
  if (typeof originalName !== 'string' || originalName.length === 0) {
    throw new ValidationError('Tên tệp không hợp lệ');
  }

  const normalized = Array.from(path.basename(originalName.replace(/\\/g, '/')))
    .filter((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint > 0x1f && codePoint !== 0x7f;
    })
    .join('');
  if (!normalized || normalized.length > 255) {
    throw new ValidationError('Tên tệp không hợp lệ');
  }
  return normalized;
}

async function saveFile({
  buffer,
  originalName,
  subdirectory = 'materials',
  baseDirectory = config.UPLOAD_DIR
}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new ValidationError('Tệp tải lên rỗng hoặc không hợp lệ');
  }
  if (
    typeof subdirectory !== 'string' ||
    !/^[a-z0-9_-]+(?:[\\/][a-z0-9_-]+)*$/i.test(subdirectory)
  ) {
    throw new ValidationError('Thư mục lưu trữ không hợp lệ');
  }

  const safeName = getSafeOriginalName(originalName);
  const extension = path.extname(safeName).toLowerCase();
  const allowedMimeTypes = extensions.get(extension);
  if (!allowedMimeTypes) {
    throw new ValidationError('Loại định dạng tệp không được hỗ trợ');
  }

  const detected = await FileType.fromBuffer(buffer);
  if (!detected || !allowedMimeTypes.has(detected.mime)) {
    throw new ValidationError('Nội dung tệp không khớp với phần mở rộng');
  }

  const root = path.resolve(baseDirectory);
  const directory = path.resolve(root, subdirectory);
  validateStoragePath(root, directory);

  const fileUuid = crypto.randomUUID();
  const destination = path.join(directory, `${fileUuid}${extension}`);
  const temporary = `${destination}.tmp`;
  let temporaryCreated = false;
  let destinationCreated = false;

  try {
    await fs.mkdir(directory, { recursive: true });
    temporaryCreated = true;
    await fs.writeFile(temporary, buffer, { flag: 'wx', mode: 0o600 });
    await fs.rename(temporary, destination);
    temporaryCreated = false;
    destinationCreated = true;

    const mimeType =
      extension === '.docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : extension === '.pptx'
          ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
          : detected.mime;

    return {
      fileUuid,
      filePath: destination,
      fileSizeBytes: buffer.length,
      mimeType,
      originalFilename: safeName
    };
  } catch (error) {
    const cleanupErrors = [];
    for (const [filePath, shouldRemove] of [
      [temporary, temporaryCreated],
      [destination, destinationCreated]
    ]) {
      if (shouldRemove) {
        try {
          await fs.rm(filePath, { force: true });
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

module.exports = { saveFile };
