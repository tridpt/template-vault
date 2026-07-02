import express from 'express';
import multer from 'multer';
import { fileURLToPath } from 'node:url';

// Load environment variables from a local .env file if present (optional).
try { process.loadEnvFile(); } catch { /* no .env file, that's fine */ }

import templatesRouter from './routes/templates.js';
import backupRouter from './routes/backup.js';
import { PUBLIC_DIR, THUMB_DIR, PREVIEW_DIR } from './paths.js';

export function createApp() {
  const app = express();

  app.use(express.json());

  // API
  app.use('/api', templatesRouter);
  app.use('/api', backupRouter);

  // Static assets
  app.use('/thumbnails', express.static(THUMB_DIR));
  app.use('/previews', express.static(PREVIEW_DIR));
  app.use('/', express.static(PUBLIC_DIR));

  // Error handler (covers multer file-size / filter errors)
  app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError || err?.message) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  });

  return app;
}

// Only start a server when run directly (not when imported by tests).
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const PORT = process.env.PORT || 4000;
  createApp().listen(PORT, () => {
    console.log(`Template Vault running at http://localhost:${PORT}`);
  });
}

export default createApp;
