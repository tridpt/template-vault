# Security Policy

## Reporting a vulnerability

Please report security issues **privately**. Do not open a public issue, pull
request, or discussion for a vulnerability.

- Use GitHub's [private vulnerability reporting](https://github.com/tridpt/template-cault/security/advisories/new) (Security tab → "Report a vulnerability"), or
- Contact the maintainer directly through their GitHub profile.

Please include:
- A description of the issue and its impact.
- Steps to reproduce or a proof of concept.
- Affected version or commit.

We aim to acknowledge reports within a few days and will keep you updated on the fix.

## Scope and notes

Template Vault stores and previews user-uploaded web templates. A few design
points worth knowing:

- **Uploaded HTML is served as-is** for live preview. Any HTML/JS inside an
  uploaded template runs in the browser under the app's origin. This is safe for
  a personal vault, but if you expose the app to multiple untrusted users, treat
  previews as untrusted active content.
- **Archive extraction is guarded against zip-slip**, and single-file serving is
  guarded against path traversal (`src/archive.js`).
- **Auth is opt-in.** With `ADMIN_TOKEN` unset the app is fully open (intended for
  local use). Set `ADMIN_TOKEN` to require a token on all write operations. Reads,
  previews, and downloads stay public by design.
- Tokens are compared with `crypto.timingSafeEqual`. Never commit `ADMIN_TOKEN`.
- Run behind HTTPS and an IP-level rate limit if you deploy publicly.

## Supported versions

The latest version on the `main` branch receives security fixes.
