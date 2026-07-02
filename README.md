# Template Vault

[![CI](https://github.com/tridpt/template-vault/actions/workflows/ci.yml/badge.svg)](https://github.com/tridpt/template-vault/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20.6-brightgreen.svg)](package.json)

A small web app to store, tag, search, preview and download your web templates.

![Template Vault](docs/screenshot.png)

For detailed Vietnamese documentation, see [`TAI_LIEU.md`](TAI_LIEU.md).

## Features

- Upload a template as a `.zip` archive with an optional thumbnail image
- Add a title, description and comma-separated tags
- Edit a template later: change title/description/tags or swap the zip/thumbnail
- Search by title/description, filter by tag, sort (newest/oldest/title/downloads)
- Pagination for large collections
- Detail view with full description, large thumbnail and the file list
- View, download or copy the URL of individual files inside a template
- Live preview: the archive is extracted and its entry `index.html` is served
- Download the original `.zip` (tracked as a download count)
- Delete a template (removes DB row + files)
- Optional token auth: protect writes with `ADMIN_TOKEN` (reads stay public)
- Backup: export everything to one `.zip` and import it back (merge or replace)
- Docker support (Dockerfile + docker-compose with persistent volumes)
- SQLite database via `better-sqlite3` (no external DB server needed)

## Stack

- Node.js + Express (ES modules)
- `better-sqlite3` for storage
- `multer` for file uploads
- `adm-zip` for archive extraction (with zip-slip protection)
- Vanilla HTML/CSS/JS frontend

## Getting started

```bash
npm install
npm run dev      # or: npm start
```

Then open http://localhost:4000

Set a custom port with the `PORT` env var (see `.env.example`).

## Running in the background (Windows)

To keep the server running without a visible terminal window:

- **Start:** double-click `scripts/start-template-vault.vbs` (launches hidden). Logs are written to `logs/server.out.log` and `logs/server.err.log`.
- **Stop:** run `scripts/stop-template-vault.cmd` (kills whatever listens on port 4000).
- **Foreground (see console):** run `scripts/run-template-vault.cmd` directly.

To start automatically on login, put a shortcut to `start-template-vault.vbs` in your
Startup folder (press Win+R, type `shell:startup`, drop the shortcut there).

## Authentication (optional)

By default the app is fully open, which is fine for local use. To require a token
for all write operations (create/edit/delete), set `ADMIN_TOKEN` in `.env`:

```
ADMIN_TOKEN=your-long-random-secret
```

When set, the API expects `Authorization: Bearer your-long-random-secret` on
`POST`, `PATCH` and `DELETE` requests. Reading, previewing and downloading stay
public. In the UI a "🔒 Đăng nhập" button appears — enter the token once and it is
stored in the browser. `GET /api/auth` reports whether a token is required.

## Backup & restore

- **Export:** the "⬇ Export" button (or `GET /api/backup/export`) downloads a single
  `.zip` containing `manifest.json` plus every archive and thumbnail.
- **Import:** the "⬆ Import" button (or `POST /api/backup/import`) restores from that
  zip. Choose *replace* (wipe existing first, `?replace=1`) or *merge* (add on top).
  Previews are re-extracted automatically from the restored archives.

## Running with Docker

```bash
docker compose up --build
```

The app is served on `http://localhost:4000`. `data/` and `storage/` are bind-mounted
so your templates persist across rebuilds. Set `ADMIN_TOKEN` in `.env` to require auth.

## Testing

```bash
npm test
```

Tests use `node --test` and run against an in-memory-ish throwaway data directory
(`test/setup.js` redirects `DATA_DIR`/`STORAGE_DIR` to a temp folder), so they never
touch your real `data/` or `storage/`.

## Project layout

```
src/
  index.js            Express server + static hosting (createApp factory)
  db.js               SQLite schema/connection + migrations
  store.js            Data access (templates, tags, search, backup)
  paths.js            Storage directory setup
  archive.js          Zip extraction, preview file helpers (zip-slip safe)
  middleware/
    auth.js           Optional token auth
  routes/
    templates.js      REST API + upload/extract/download
    backup.js         Export / import endpoints
public/
  index.html          Gallery UI
  style.css
  app.js
scripts/              Windows background start/stop helpers
test/
  setup.js            Redirects storage to a temp dir for tests
  templates.test.js   API tests (node --test)
data/                 SQLite file (gitignored)
storage/              uploads / thumbnails / extracted previews (gitignored)
```

## API

| Method | Path                          | Description                          |
| ------ | ----------------------------- | ------------------------------------ |
| GET    | `/api/templates?q=&tag=&sort=&page=&pageSize=` | Paginated list. `sort`: newest \| oldest \| title \| downloads |
| GET    | `/api/templates/:id`          | Get one template                     |
| POST   | `/api/templates`              | Create (multipart form)              |
| PATCH  | `/api/templates/:id`          | Update fields and/or replace files   |
| GET    | `/api/templates/:id/files`    | List files inside the archive        |
| GET    | `/api/templates/:id/file?path=&download=1` | View or download a single file |
| GET    | `/api/templates/:id/download` | Download the original archive (bumps download count) |
| DELETE | `/api/templates/:id`          | Delete a template                    |
| GET    | `/api/tags`                   | List tags with counts                |
| GET    | `/api/auth`                   | Whether a token is required for writes |
| GET    | `/api/backup/export`          | Download a full backup zip           |
| POST   | `/api/backup/import`          | Restore from a backup zip (`?replace=1` to wipe first) |

### List response

```json
{ "items": [ ... ], "total": 4, "page": 1, "pageSize": 12, "pages": 1, "sort": "newest" }
```

### Create payload (multipart/form-data)

- `title` (required)
- `description`
- `tags` — comma separated, e.g. `landing, dark, tailwind`
- `archive` — a `.zip` file (optional)
- `thumbnail` — an image file (optional)
