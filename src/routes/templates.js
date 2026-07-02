import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  createTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
  deleteTemplate,
  incrementDownloads,
  listTags,
} from '../store.js';
import { UPLOAD_DIR, THUMB_DIR, PREVIEW_DIR } from '../paths.js';
import { requireAuth, authEnabled } from '../middleware/auth.js';
import {
  safeExtract,
  findEntryFile,
  listArchiveFiles,
  resolvePreviewFile,
  processArchiveFile,
} from '../archive.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, file.fieldname === 'thumbnail' ? THUMB_DIR : UPLOAD_DIR);
  },
  filename(req, file, cb) {
    const id = crypto.randomBytes(8).toString('hex');
    cb(null, `${id}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB per file
  fileFilter(req, file, cb) {
    if (file.fieldname === 'archive') {
      const ok = /\.zip$/i.test(file.originalname);
      return cb(ok ? null : new Error('Template archive must be a .zip file'), ok);
    }
    if (file.fieldname === 'thumbnail') {
      const ok = /\.(png|jpe?g|gif|webp|svg)$/i.test(file.originalname);
      return cb(ok ? null : new Error('Thumbnail must be an image'), ok);
    }
    return cb(null, false);
  },
});

// GET /api/templates  -> paginated list with ?q= &tag= &sort= &page= &pageSize=
router.get('/templates', (req, res) => {
  const { q = '', tag = '', sort = 'newest', page = '1', pageSize = '12' } = req.query;
  res.json(listTemplates({
    q: String(q),
    tag: String(tag),
    sort: String(sort),
    page: Number(page),
    pageSize: Number(pageSize),
  }));
});

// GET /api/auth  -> whether a token is required to write
router.get('/auth', (req, res) => {
  res.json({ required: authEnabled() });
});

// GET /api/tags
router.get('/tags', (req, res) => {
  res.json(listTags());
});

// GET /api/templates/:id
router.get('/templates/:id', (req, res) => {
  const tpl = getTemplate(Number(req.params.id));
  if (!tpl) return res.status(404).json({ error: 'Not found' });
  res.json(tpl);
});

// POST /api/templates  (multipart: archive, thumbnail, title, description, tags)
router.post(
  '/templates',
  requireAuth,
  upload.fields([
    { name: 'archive', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ]),
  (req, res) => {
    const title = String(req.body.title || '').trim();
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const archive = req.files?.archive?.[0] || null;
    const thumb = req.files?.thumbnail?.[0] || null;

    let previewDir = null;
    let entryFile = null;

    if (archive) {
      try {
        ({ previewDir, entryFile } = processArchiveFile(archive.path, archive.filename));
      } catch (err) {
        fs.rmSync(path.join(PREVIEW_DIR, path.basename(archive.filename, path.extname(archive.filename))), { recursive: true, force: true });
        fs.rmSync(archive.path, { force: true });
        if (thumb) fs.rmSync(thumb.path, { force: true });
        return res.status(400).json({ error: err.message });
      }
    }

    const tpl = createTemplate({
      title,
      description: String(req.body.description || '').trim(),
      tags: req.body.tags || '',
      archiveFile: archive ? archive.filename : null,
      thumbnail: thumb ? thumb.filename : null,
      previewDir,
      entryFile,
    });

    res.status(201).json(tpl);
  }
);

// PATCH /api/templates/:id  (multipart: optional new archive/thumbnail + fields)
router.patch(
  '/templates/:id',
  requireAuth,
  upload.fields([
    { name: 'archive', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ]),
  (req, res) => {
    const id = Number(req.params.id);
    const existing = getTemplate(id);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const archive = req.files?.archive?.[0] || null;
    const thumb = req.files?.thumbnail?.[0] || null;
    const fields = {};

    if (req.body.title !== undefined) {
      const title = String(req.body.title).trim();
      if (!title) {
        if (archive) fs.rmSync(archive.path, { force: true });
        if (thumb) fs.rmSync(thumb.path, { force: true });
        return res.status(400).json({ error: 'Title cannot be empty' });
      }
      fields.title = title;
    }
    if (req.body.description !== undefined) {
      fields.description = String(req.body.description).trim();
    }
    if (req.body.tags !== undefined) {
      fields.tags = req.body.tags;
    }

    // Replace archive: extract new one, then clean up the old files.
    if (archive) {
      try {
        const { previewDir, entryFile } = processArchiveFile(archive.path, archive.filename);
        fields.archive_file = archive.filename;
        fields.preview_dir = previewDir;
        fields.entry_file = entryFile;
      } catch (err) {
        fs.rmSync(path.join(PREVIEW_DIR, path.basename(archive.filename, path.extname(archive.filename))), { recursive: true, force: true });
        fs.rmSync(archive.path, { force: true });
        if (thumb) fs.rmSync(thumb.path, { force: true });
        return res.status(400).json({ error: err.message });
      }
      if (existing.archive_file) fs.rmSync(path.join(UPLOAD_DIR, existing.archive_file), { force: true });
      if (existing.preview_dir) fs.rmSync(path.join(PREVIEW_DIR, existing.preview_dir), { recursive: true, force: true });
    }

    // Replace thumbnail.
    if (thumb) {
      fields.thumbnail = thumb.filename;
      if (existing.thumbnail) fs.rmSync(path.join(THUMB_DIR, existing.thumbnail), { force: true });
    }

    res.json(updateTemplate(id, fields));
  }
);

// GET /api/templates/:id/files  -> list files inside the archive
router.get('/templates/:id/files', (req, res) => {
  const tpl = getTemplate(Number(req.params.id));
  if (!tpl) return res.status(404).json({ error: 'Not found' });
  if (!tpl.preview_dir) return res.json([]);
  res.json(listArchiveFiles(tpl.preview_dir));
});

// GET /api/templates/:id/file?path=...  -> raw single file (view or ?download=1)
router.get('/templates/:id/file', (req, res) => {
  const tpl = getTemplate(Number(req.params.id));
  if (!tpl || !tpl.preview_dir) return res.status(404).json({ error: 'Not found' });
  const rel = String(req.query.path || '');
  const file = resolvePreviewFile(tpl.preview_dir, rel);
  if (!file) return res.status(404).json({ error: 'File not found' });
  if (req.query.download) {
    return res.download(file, path.basename(file));
  }
  res.sendFile(file);
});

// GET /api/templates/:id/download
router.get('/templates/:id/download', (req, res) => {
  const tpl = getTemplate(Number(req.params.id));
  if (!tpl || !tpl.archive_file) {
    return res.status(404).json({ error: 'No archive available' });
  }
  const file = path.join(UPLOAD_DIR, tpl.archive_file);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'File missing' });
  incrementDownloads(tpl.id);
  res.download(file, `${tpl.slug}.zip`);
});

// DELETE /api/templates/:id
router.delete('/templates/:id', requireAuth, (req, res) => {
  const tpl = deleteTemplate(Number(req.params.id));
  if (!tpl) return res.status(404).json({ error: 'Not found' });

  if (tpl.archive_file) fs.rmSync(path.join(UPLOAD_DIR, tpl.archive_file), { force: true });
  if (tpl.thumbnail) fs.rmSync(path.join(THUMB_DIR, tpl.thumbnail), { force: true });
  if (tpl.preview_dir) {
    fs.rmSync(path.join(PREVIEW_DIR, tpl.preview_dir), { recursive: true, force: true });
  }
  res.json({ ok: true });
});

export default router;
