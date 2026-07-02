import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'templates.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS templates (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    title         TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    slug          TEXT NOT NULL UNIQUE,
    archive_file  TEXT,
    thumbnail     TEXT,
    preview_dir   TEXT,
    entry_file    TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tags (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS template_tags (
    template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    tag_id      INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (template_id, tag_id)
  );

  CREATE INDEX IF NOT EXISTS idx_template_tags_tag ON template_tags(tag_id);
`);

// --- Migrations for existing databases ---
const columns = db.prepare(`PRAGMA table_info(templates)`).all().map((c) => c.name);
if (!columns.includes('downloads')) {
  db.exec(`ALTER TABLE templates ADD COLUMN downloads INTEGER NOT NULL DEFAULT 0`);
}

export default db;
