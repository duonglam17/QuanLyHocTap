import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(frontendRoot, 'src');
const violations = [];
const importPattern =
  /\b(?:from\s*|import\s*|require\s*\(\s*)['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function listSourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(entryPath);
    return /\.(?:js|jsx|ts|tsx|mjs)$/.test(entry.name) ? [entryPath] : [];
  });
}

function resolveImport(importer, importPath) {
  if (importPath.startsWith('@/')) {
    return path.resolve(sourceRoot, importPath.slice(2));
  }
  if (importPath.startsWith('.')) return path.resolve(path.dirname(importer), importPath);
  return null;
}

function moduleFromPath(filePath) {
  return filePath.match(/[\\/]modules[\\/](m[1-3])(?:[\\/]|$)/)?.[1] ?? null;
}

const files = listSourceFiles(sourceRoot);
files.forEach((filePath) => {
  const sourceModule = moduleFromPath(filePath);
  const isSharedSource = filePath.includes(`${path.sep}shared${path.sep}`);
  if (!sourceModule && !isSharedSource) return;

  const source = fs.readFileSync(filePath, 'utf8');
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1] ?? match[2];
    const targetPath = resolveImport(filePath, specifier);
    if (!targetPath) continue;
    const targetModule = moduleFromPath(targetPath);
    const isModuleImport = specifier.startsWith('@/modules/') || targetModule !== null;

    if (isSharedSource && isModuleImport) {
      violations.push(`${path.relative(frontendRoot, filePath)} imports module code (${specifier})`);
    } else if (sourceModule && targetModule && sourceModule !== targetModule) {
      violations.push(
        `${path.relative(frontendRoot, filePath)} (${sourceModule}) imports ${targetModule} code (${specifier})`
      );
    }
  }
});

if (violations.length > 0) {
  console.error('Frontend dependency boundary violations:');
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exitCode = 1;
} else {
  console.log('Frontend dependency boundaries are valid.');
}
