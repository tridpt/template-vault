// Preloaded before any test module (via `node --import`).
// Redirects the database and file storage to a throwaway temp directory so
// tests never touch the real data/ or storage/ folders. Cleaned each run.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.join(os.tmpdir(), 'template-vault-test');
fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });

process.env.DATA_DIR = path.join(root, 'data');
process.env.STORAGE_DIR = path.join(root, 'storage');
