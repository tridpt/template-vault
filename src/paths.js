import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.join(__dirname, '..');
const STORAGE = process.env.STORAGE_DIR || path.join(ROOT, 'storage');
export const UPLOAD_DIR = path.join(STORAGE, 'uploads');
export const THUMB_DIR = path.join(STORAGE, 'thumbnails');
export const PREVIEW_DIR = path.join(STORAGE, 'previews');
export const PUBLIC_DIR = path.join(ROOT, 'public');

for (const dir of [UPLOAD_DIR, THUMB_DIR, PREVIEW_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}
