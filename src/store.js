import db from './db.js';

function slugify(text) {
  const base = String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'template';
  // Ensure uniqueness.
  let slug = base;
  let n = 1;
  while (db.prepare('SELECT 1 FROM templates WHERE slug = ?').get(slug)) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

function normalizeTags(tags) {
  const list = Array.isArray(tags)
    ? tags
    : String(tags || '').split(',');
  return [...new Set(
    list
      .map((t) => String(t).trim().toLowerCase())
      .filter(Boolean)
  )];
}

const upsertTag = db.prepare(
  'INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING'
);
const getTagId = db.prepare('SELECT id FROM tags WHERE name = ?');
const linkTag = db.prepare(
  'INSERT OR IGNORE INTO template_tags (template_id, tag_id) VALUES (?, ?)'
);

function setTags(templateId, tags) {
  const names = normalizeTags(tags);
  for (const name of names) {
    upsertTag.run(name);
    const { id } = getTagId.get(name);
    linkTag.run(templateId, id);
  }
}

function tagsFor(templateId) {
  return db
    .prepare(`
      SELECT t.name FROM tags t
      JOIN template_tags tt ON tt.tag_id = t.id
      WHERE tt.template_id = ?
      ORDER BY t.name
    `)
    .all(templateId)
    .map((r) => r.name);
}

function hydrate(row) {
  if (!row) return null;
  return { ...row, tags: tagsFor(row.id) };
}

export function createTemplate({
  title,
  description = '',
  tags = [],
  archiveFile = null,
  thumbnail = null,
  previewDir = null,
  entryFile = null,
}) {
  const slug = slugify(title);
  const info = db
    .prepare(`
      INSERT INTO templates
        (title, description, slug, archive_file, thumbnail, preview_dir, entry_file)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .run(title, description, slug, archiveFile, thumbnail, previewDir, entryFile);
  setTags(info.lastInsertRowid, tags);
  return getTemplate(info.lastInsertRowid);
}

export function getTemplate(id) {
  return hydrate(db.prepare('SELECT * FROM templates WHERE id = ?').get(id));
}

const SORTS = {
  newest: 't.created_at DESC, t.id DESC',
  oldest: 't.created_at ASC, t.id ASC',
  title: 't.title COLLATE NOCASE ASC',
  downloads: 't.downloads DESC, t.id DESC',
};

export function listTemplates({ q = '', tag = '', sort = 'newest', page = 1, pageSize = 12 } = {}) {
  const clauses = [];
  const params = {};

  if (q.trim()) {
    clauses.push('(t.title LIKE @q OR t.description LIKE @q)');
    params.q = `%${q.trim()}%`;
  }
  if (tag.trim()) {
    clauses.push(`
      t.id IN (
        SELECT tt.template_id FROM template_tags tt
        JOIN tags tg ON tg.id = tt.tag_id
        WHERE tg.name = @tag
      )
    `);
    params.tag = tag.trim().toLowerCase();
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const orderBy = SORTS[sort] || SORTS.newest;

  const total = db
    .prepare(`SELECT COUNT(*) AS n FROM templates t ${where}`)
    .get(params).n;

  const size = Math.max(1, Math.min(60, Number(pageSize) || 12));
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.max(1, Math.min(pages, Number(page) || 1));
  const offset = (current - 1) * size;

  const rows = db
    .prepare(`
      SELECT t.* FROM templates t
      ${where}
      ORDER BY ${orderBy}
      LIMIT @limit OFFSET @offset
    `)
    .all({ ...params, limit: size, offset });

  return {
    items: rows.map(hydrate),
    total,
    page: current,
    pageSize: size,
    pages,
    sort: SORTS[sort] ? sort : 'newest',
  };
}

const clearTags = db.prepare('DELETE FROM template_tags WHERE template_id = ?');

export function updateTemplate(id, fields = {}) {
  const tpl = getTemplate(id);
  if (!tpl) return null;

  const sets = [];
  const params = { id };
  for (const key of ['title', 'description', 'archive_file', 'thumbnail', 'preview_dir', 'entry_file']) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = @${key}`);
      params[key] = fields[key];
    }
  }
  if (sets.length) {
    db.prepare(`UPDATE templates SET ${sets.join(', ')} WHERE id = @id`).run(params);
  }
  if (fields.tags !== undefined) {
    clearTags.run(id);
    setTags(id, fields.tags);
    db.prepare(`
      DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM template_tags)
    `).run();
  }
  return getTemplate(id);
}

export function incrementDownloads(id) {
  db.prepare('UPDATE templates SET downloads = downloads + 1 WHERE id = ?').run(id);
}

export function deleteTemplate(id) {
  const tpl = getTemplate(id);
  if (!tpl) return null;
  db.prepare('DELETE FROM templates WHERE id = ?').run(id);
  // Clean up orphan tags.
  db.prepare(`
    DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM template_tags)
  `).run();
  return tpl;
}

export function listTags() {
  return db
    .prepare(`
      SELECT t.name AS name, COUNT(tt.template_id) AS count
      FROM tags t
      LEFT JOIN template_tags tt ON tt.tag_id = t.id
      GROUP BY t.id
      ORDER BY count DESC, t.name ASC
    `)
    .all();
}

// --- Backup helpers ---

export function exportAll() {
  const rows = db.prepare('SELECT * FROM templates ORDER BY id ASC').all();
  return rows.map(hydrate);
}

// Insert a template preserving created_at and downloads (used by import).
export function importTemplate({
  title,
  description = '',
  tags = [],
  archiveFile = null,
  thumbnail = null,
  previewDir = null,
  entryFile = null,
  createdAt = null,
  downloads = 0,
}) {
  const slug = slugify(title);
  const info = db
    .prepare(`
      INSERT INTO templates
        (title, description, slug, archive_file, thumbnail, preview_dir, entry_file, created_at, downloads)
      VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), ?)
    `)
    .run(title, description, slug, archiveFile, thumbnail, previewDir, entryFile, createdAt, downloads);
  setTags(info.lastInsertRowid, tags);
  return getTemplate(info.lastInsertRowid);
}

export function clearAllTemplates() {
  db.prepare('DELETE FROM templates').run();
  db.prepare('DELETE FROM tags').run();
}
