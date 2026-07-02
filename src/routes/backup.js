import express from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { UPLOAD_DIR, THUMB_DIR } from '../paths.js';
import { exportAll, importTemplate, clearAllTemplates } from '../store.js';
import { processArchiveFile } from '../archive.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const memUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB backup cap
});

// GET /api/backup/export -> a single .zip containing manifest + all files.
router.get('/backup/export', requireAuth, (req, res) => {
  const templates = exportAll();
  const zip = new AdmZip();
  const manifest = [];

  for (const t of templates) {
    const entry = {
      title: t.title,
      description: t.description,
      tags: t.tags,
      entry_file: t.entry_file,
      created_at: t.created_at,
      downloads: t.downloads,
      archive_file: null,
      thumbnail: null,
    };

    if (t.archive_file) {
      const ap = path.join(UPLOAD_DIR, t.archive_file);
      if (fs.existsSync(ap)) {
        zip.addLocalFile(ap, 'uploads');
        entry.archive_file = t.archive_file;
      }
    }
    if (t.thumbnail) {
      const tp = path.join(THUMB_DIR, t.thumbnail);
      if (fs.existsSync(tp)) {
        zip.addLocalFile(tp, 'thumbnails');
        entry.thumbnail = t.thumbnail;
      }
    }
    manifest.push(entry);
  }

  zip.addFile(
    'manifest.json',
    Buffer.from(JSON.stringify({ version: 1, exported_at: new Date().toISOString(), templates: manifest }, null, 2))
  );

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="template-vault-backup-${stamp}.zip"`);
  res.send(zip.toBuffer());
});

// POST /api/backup/import  (multipart: backup=<zip>, ?replace=1 wipes existing)
router.post('/backup/import', requireAuth, memUpload.single('backup'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No backup file uploaded' });

  let zip;
  try {
    zip = new AdmZip(req.file.buffer);
  } catch {
    return res.status(400).json({ error: 'Invalid zip file' });
  }

  const manifestEntry = zip.getEntry('manifest.json');
  if (!manifestEntry) return res.status(400).json({ error: 'Backup is missing manifest.json' });

  let manifest;
  try {
    manifest = JSON.parse(zip.readAsText(manifestEntry));
  } catch {
    return res.status(400).json({ error: 'Corrupt manifest.json' });
  }
  if (!Array.isArray(manifest.templates)) {
    return res.status(400).json({ error: 'Manifest has no templates array' });
  }

  if (req.query.replace) clearAllTemplates();

  let imported = 0;
  const errors = [];

  for (const t of manifest.templates) {
    try {
      let archiveFile = null;
      let previewDir = null;
      let entryFile = t.entry_file || null;
      let thumbnail = null;

      // Restore the archive with a fresh unique name, then re-extract preview.
      if (t.archive_file) {
        const src = zip.getEntry(`uploads/${t.archive_file}`);
        if (src) {
          const newName = `${crypto.randomBytes(8).toString('hex')}.zip`;
          const dest = path.join(UPLOAD_DIR, newName);
          fs.writeFileSync(dest, src.getData());
          archiveFile = newName;
          ({ previewDir, entryFile } = processArchiveFile(dest, newName));
        }
      }

      // Restore the thumbnail with a fresh unique name.
      if (t.thumbnail) {
        const src = zip.getEntry(`thumbnails/${t.thumbnail}`);
        if (src) {
          const ext = path.extname(t.thumbnail) || '.png';
          const newName = `${crypto.randomBytes(8).toString('hex')}${ext}`;
          fs.writeFileSync(path.join(THUMB_DIR, newName), src.getData());
          thumbnail = newName;
        }
      }

      importTemplate({
        title: t.title || 'Untitled',
        description: t.description || '',
        tags: t.tags || [],
        archiveFile,
        thumbnail,
        previewDir,
        entryFile,
        createdAt: t.created_at || null,
        downloads: Number(t.downloads) || 0,
      });
      imported += 1;
    } catch (err) {
      errors.push({ title: t.title, error: err.message });
    }
  }

  res.json({ imported, total: manifest.templates.length, errors });
});

export default router;
