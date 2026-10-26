import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const uploadsDirectory = path.resolve(directory, '../.generated/uploads');

export async function createUploadFiles() {
  await mkdir(uploadsDirectory, { recursive: true });
  const pdf = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n'
  );
  const emptyZip = Buffer.from('UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==', 'base64');
  const oversizedZip = Buffer.alloc(20 * 1024 * 1024 + 1);

  const files = {
    pdf: { name: 'e2e-small.pdf', mimeType: 'application/pdf', buffer: pdf },
    zip: { name: 'e2e-empty.zip', mimeType: 'application/zip', buffer: emptyZip },
    invalid: {
      name: 'e2e-invalid.exe',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('not an allowed upload')
    },
    oversized: {
      name: 'e2e-too-large.zip',
      mimeType: 'application/zip',
      buffer: oversizedZip
    }
  };

  const result = {};
  for (const [key, file] of Object.entries(files)) {
    const filePath = path.join(uploadsDirectory, file.name);
    await writeFile(filePath, file.buffer);
    result[key] = { ...file, path: filePath };
  }
  return result;
}
