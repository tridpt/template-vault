# Changelog

All notable changes to Template Vault are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-07-02

### Added
- Upload web templates as `.zip` archives with an optional thumbnail, title,
  description and comma-separated tags.
- SQLite storage via `better-sqlite3` with a many-to-many tag model.
- Search by title/description, filter by tag, and sort by newest, oldest, title
  or download count.
- Pagination with a `{ items, total, page, pageSize, pages, sort }` envelope.
- Live preview: archives are extracted and their entry `index.html` is served.
- Detail view listing every file inside a template, with view/download/copy-URL
  actions per file.
- Edit templates: change title/description/tags or swap the zip/thumbnail while
  keeping existing files when omitted.
- Download the original archive with a per-template download counter.
- Optional token authentication (`ADMIN_TOKEN`): writes require a token while
  reads stay public. Tokens are compared with `crypto.timingSafeEqual`.
- Backup: export the whole vault to a single `.zip` (manifest + files) and import
  it back in either replace or merge mode.
- Security hardening: zip-slip protection on extraction and path-traversal
  protection when serving individual files.
- Docker support (multi-stage `Dockerfile` + `docker-compose.yml` with persistent
  volumes for `data/` and `storage/`).
- Windows background run helpers (`scripts/start`/`stop`/`run`).
- Test suite (17 tests) using `node --test`, isolated to a temp data directory.
- Vietnamese technical documentation (`TAI_LIEU.md`).
- Continuous integration (GitHub Actions) running the test suite on Node 20 and 22.

[1.0.0]: https://github.com/tridpt/template-vault/releases/tag/v1.0.0
