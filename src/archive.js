import AdmZip from 'adm-zip';
import fs from 'node:fs';
import path from 'node:path';
import { PREVIEW_DIR } from './paths.js';

// Guard against zip-slip: reject entries that escape the target directory.
export function safeExtract(zipPath, destDir) {
  const zip = new AdmZip(zipPath);
  const resolvedDest = path.resolve(destDir);
  for (const entry of zip.getEntries()) {
    const target = path.resolve(destDir, entry.entryName);
    if (target !== resolvedDest && !target.startsWith(resolvedDest + path.sep)) {
      throw new Error(`Unsafe path in archive: ${entry.entryName}`);
    }
  }
  fs.mkdirSync(destDir, { recursive: true });
  zip.extractAllTo(destDir, true);
}

// Find the best entry HTML file for live preview.
export function findEntryFile(dir) {
  const walk = (current, depth) => {
    if (depth > 4) return [];
    let results = [];
    for (const name of fs.readdirSync(current)) {
      const full = path.join(current, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        results = results.concat(walk(full, depth + 1));
      } else if (/\.html?$/i.test(name)) {
        results.push(full);
      }
    }
    return results;
  };
  const htmls = walk(dir, 0);
  if (htmls.length === 0) return null;
  htmls.sort((a, b) => {
    const ai = /index\.html?$/i.test(a) ? 0 : 1;
    const bi = /index\.html?$/i.test(b) ? 0 : 1;
    if (ai !== bi) return ai - bi;
    return a.split(path.sep).length - b.split(path.sep).length;
  });
  return path.relative(dir, htmls[0]).split(path.sep).join('/');
}

// List every file inside an extracted preview dir with its relative path + size.
export function listArchiveFiles(previewDir) {
  const base = path.join(PREVIEW_DIR, previewDir);
  if (!fs.existsSync(base)) return [];
  const out = [];
  const walk = (current) => {
    for (const name of fs.readdirSync(current)) {
      const full = path.join(current, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full);
      else out.push({ path: path.relative(base, full).split(path.sep).join('/'), size: stat.size });
    }
  };
  walk(base);
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}

// Resolve a file inside a preview dir, blocking path traversal.
export function resolvePreviewFile(previewDir, relPath) {
  const base = path.resolve(PREVIEW_DIR, previewDir);
  const target = path.resolve(base, relPath);
  if (target !== base && !target.startsWith(base + path.sep)) return null;
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return null;
  return target;
}

// Extract an archive file into the preview dir; returns { previewDir, entryFile }.
export function processArchiveFile(archivePath, filename) {
  const dirName = path.basename(filename, path.extname(filename));
  const dest = path.join(PREVIEW_DIR, dirName);
  safeExtract(archivePath, dest);
  return { previewDir: dirName, entryFile: findEntryFile(dest) };
}
