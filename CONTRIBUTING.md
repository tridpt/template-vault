# Contributing to Template Vault

Thanks for your interest! Template Vault is a small, dependency-light project:
Node.js and Express on the server, SQLite (`better-sqlite3`) for storage, and
plain HTML/CSS/JavaScript on the client. No build step.

For a detailed technical walkthrough (in Vietnamese), see [`TAI_LIEU.md`](TAI_LIEU.md).

## Getting started

Requires Node.js 22 or newer (the app uses `process.loadEnvFile()`).

```bash
npm ci          # install dependencies from the lockfile
npm start       # run the server at http://localhost:4000
npm run dev     # run with --watch (auto-restart on changes)
npm test        # run the test suite (node --test)
```

## How to contribute

1. Fork the repo and create a branch: `git checkout -b feature/your-feature`.
2. Make your change. Match the existing style: ES modules, small focused files,
   data access kept in `src/store.js`, and shared zip logic in `src/archive.js`.
3. Add or update tests in `test/templates.test.js` when you change behavior.
4. Run `npm test` and make sure everything passes.
5. Commit with a clear message and open a Pull Request describing what and why.

## Good first contributions

- **UI polish** — `public/style.css` and `public/app.js` (vanilla, no framework).
- **New sort or filter options** — extend the `SORTS` map in `src/store.js`.
- **More archive formats** — preview currently targets HTML entry files.
- **Accessibility** — keyboard navigation and ARIA labels in the gallery/modals.

## Guidelines

- Keep the client framework-free and the server files small and readable.
- Validate and sanitize all file paths; preserve the zip-slip and path-traversal
  guards in `src/archive.js`.
- Never commit secrets (e.g. `ADMIN_TOKEN`), the `data/` directory, or `storage/`.
- Update the docs (`README.md` / `TAI_LIEU.md`) when behavior changes.

## Reporting security issues

Please do not open a public issue for security problems. See [`SECURITY.md`](SECURITY.md).
