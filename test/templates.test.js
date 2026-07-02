import test from 'node:test';
import assert from 'node:assert/strict';
import AdmZip from 'adm-zip';
import { createApp } from '../src/index.js';

// Start the app on an ephemeral port for each test run.
function startServer() {
  const app = createApp();
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

// Build a small in-memory zip for upload.
function sampleZip(files = { 'index.html': '<h1>Hi</h1>', 'css/main.css': 'body{}' }) {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(files)) {
    zip.addFile(name, Buffer.from(content));
  }
  return zip.toBuffer();
}

async function createTemplate(base, { title = 'Test Template', tags = 'alpha, beta', files } = {}) {
  const fd = new FormData();
  fd.set('title', title);
  fd.set('description', 'A test template');
  fd.set('tags', tags);
  fd.set('archive', new Blob([sampleZip(files)], { type: 'application/zip' }), 'test.zip');
  const res = await fetch(`${base}/api/templates`, { method: 'POST', body: fd });
  return { res, body: await res.json() };
}

test('creates a template and extracts the archive', async () => {
  const { server, base } = await startServer();
  try {
    const { res, body } = await createTemplate(base, { title: 'Landing One' });
    assert.equal(res.status, 201);
    assert.equal(body.title, 'Landing One');
    assert.equal(body.entry_file, 'index.html');
    assert.ok(body.preview_dir);
    assert.deepEqual(body.tags, ['alpha', 'beta']);
    assert.equal(body.downloads, 0);
  } finally {
    server.close();
  }
});

test('rejects a template without a title', async () => {
  const { server, base } = await startServer();
  try {
    const fd = new FormData();
    fd.set('description', 'no title');
    const res = await fetch(`${base}/api/templates`, { method: 'POST', body: fd });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test('rejects a non-zip archive', async () => {
  const { server, base } = await startServer();
  try {
    const fd = new FormData();
    fd.set('title', 'Bad file');
    fd.set('archive', new Blob(['not a zip'], { type: 'text/plain' }), 'note.txt');
    const res = await fetch(`${base}/api/templates`, { method: 'POST', body: fd });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test('lists templates with a pagination envelope and sorting', async () => {
  const { server, base } = await startServer();
  try {
    await createTemplate(base, { title: 'Bravo' });
    await createTemplate(base, { title: 'Alpha' });
    await createTemplate(base, { title: 'Charlie' });

    const res = await fetch(`${base}/api/templates?pageSize=2&page=1&sort=title`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.ok(data.total >= 3);
    assert.equal(data.pageSize, 2);
    assert.equal(data.items.length, 2);
    assert.ok(data.pages >= 2);
    // Title sort is ascending.
    assert.equal(data.items[0].title, 'Alpha');
    assert.equal(data.items[1].title, 'Bravo');
  } finally {
    server.close();
  }
});

test('lists files inside a template', async () => {
  const { server, base } = await startServer();
  try {
    const { body } = await createTemplate(base);
    const res = await fetch(`${base}/api/templates/${body.id}/files`);
    const files = await res.json();
    const paths = files.map((f) => f.path).sort();
    assert.deepEqual(paths, ['css/main.css', 'index.html']);
    assert.ok(files.every((f) => typeof f.size === 'number'));
  } finally {
    server.close();
  }
});

test('serves a single file and blocks path traversal', async () => {
  const { server, base } = await startServer();
  try {
    const { body } = await createTemplate(base);

    const ok = await fetch(`${base}/api/templates/${body.id}/file?path=index.html`);
    assert.equal(ok.status, 200);
    assert.ok((await ok.text()).includes('<h1>Hi</h1>'));

    const evil = await fetch(`${base}/api/templates/${body.id}/file?path=${encodeURIComponent('../../package.json')}`);
    assert.equal(evil.status, 404);
  } finally {
    server.close();
  }
});

test('download increments the download counter', async () => {
  const { server, base } = await startServer();
  try {
    const { body } = await createTemplate(base);
    assert.equal(body.downloads, 0);

    const dl = await fetch(`${base}/api/templates/${body.id}/download`);
    assert.equal(dl.status, 200);
    await dl.arrayBuffer();

    const after = await (await fetch(`${base}/api/templates/${body.id}`)).json();
    assert.equal(after.downloads, 1);
  } finally {
    server.close();
  }
});

test('updates fields via PATCH while preserving files', async () => {
  const { server, base } = await startServer();
  try {
    const { body } = await createTemplate(base, { title: 'Old Title', tags: 'x' });

    const fd = new FormData();
    fd.set('title', 'New Title');
    fd.set('tags', 'one, two, three');
    const res = await fetch(`${base}/api/templates/${body.id}`, { method: 'PATCH', body: fd });
    const updated = await res.json();

    assert.equal(res.status, 200);
    assert.equal(updated.title, 'New Title');
    assert.deepEqual(updated.tags, ['one', 'three', 'two']); // stored sorted
    // Archive/preview kept.
    assert.equal(updated.preview_dir, body.preview_dir);
    assert.equal(updated.entry_file, 'index.html');
  } finally {
    server.close();
  }
});

test('replaces the archive via PATCH', async () => {
  const { server, base } = await startServer();
  try {
    const { body } = await createTemplate(base);

    const fd = new FormData();
    const newZip = sampleZip({ 'home.html': '<p>New</p>' });
    fd.set('archive', new Blob([newZip], { type: 'application/zip' }), 'new.zip');
    const res = await fetch(`${base}/api/templates/${body.id}`, { method: 'PATCH', body: fd });
    const updated = await res.json();

    assert.equal(res.status, 200);
    assert.notEqual(updated.preview_dir, body.preview_dir);
    assert.equal(updated.entry_file, 'home.html');

    const files = await (await fetch(`${base}/api/templates/${body.id}/files`)).json();
    assert.deepEqual(files.map((f) => f.path), ['home.html']);
  } finally {
    server.close();
  }
});

test('deletes a template', async () => {
  const { server, base } = await startServer();
  try {
    const { body } = await createTemplate(base);
    const del = await fetch(`${base}/api/templates/${body.id}`, { method: 'DELETE' });
    assert.equal(del.status, 200);

    const gone = await fetch(`${base}/api/templates/${body.id}`);
    assert.equal(gone.status, 404);
  } finally {
    server.close();
  }
});

test('tags endpoint returns counts', async () => {
  const { server, base } = await startServer();
  try {
    await createTemplate(base, { title: 'Tagged', tags: 'shared, unique-one' });
    await createTemplate(base, { title: 'Tagged2', tags: 'shared' });

    const tags = await (await fetch(`${base}/api/tags`)).json();
    const shared = tags.find((t) => t.name === 'shared');
    assert.ok(shared);
    assert.ok(shared.count >= 2);
  } finally {
    server.close();
  }
});

test('auth: writes are blocked without a token when ADMIN_TOKEN is set', async () => {
  process.env.ADMIN_TOKEN = 'secret-123';
  const { server, base } = await startServer();
  try {
    // /api/auth reports it is required.
    const status = await (await fetch(`${base}/api/auth`)).json();
    assert.equal(status.required, true);

    // No token -> 401.
    const fd = new FormData();
    fd.set('title', 'Blocked');
    fd.set('archive', new Blob([sampleZip()], { type: 'application/zip' }), 'x.zip');
    const noAuth = await fetch(`${base}/api/templates`, { method: 'POST', body: fd });
    assert.equal(noAuth.status, 401);

    // Reads still work.
    const list = await fetch(`${base}/api/templates`);
    assert.equal(list.status, 200);
  } finally {
    server.close();
    delete process.env.ADMIN_TOKEN;
  }
});

test('auth: writes succeed with the correct token', async () => {
  process.env.ADMIN_TOKEN = 'secret-123';
  const { server, base } = await startServer();
  try {
    const fd = new FormData();
    fd.set('title', 'Authorized');
    fd.set('archive', new Blob([sampleZip()], { type: 'application/zip' }), 'x.zip');
    const res = await fetch(`${base}/api/templates`, {
      method: 'POST',
      headers: { Authorization: 'Bearer secret-123' },
      body: fd,
    });
    assert.equal(res.status, 201);

    // Wrong token -> 401.
    const bad = await fetch(`${base}/api/templates`, {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong' },
      body: (() => { const f = new FormData(); f.set('title', 'x'); return f; })(),
    });
    assert.equal(bad.status, 401);
  } finally {
    server.close();
    delete process.env.ADMIN_TOKEN;
  }
});

test('backup export produces a zip with a manifest and files', async () => {
  const { server, base } = await startServer();
  try {
    await createTemplate(base, { title: 'Export Me' });
    const res = await fetch(`${base}/api/backup/export`);
    assert.equal(res.status, 200);

    const buf = Buffer.from(await res.arrayBuffer());
    const zip = new AdmZip(buf);
    const manifest = JSON.parse(zip.readAsText(zip.getEntry('manifest.json')));
    assert.equal(manifest.version, 1);
    assert.ok(manifest.templates.length >= 1);
    assert.ok(zip.getEntries().some((e) => e.entryName.startsWith('uploads/')));
  } finally {
    server.close();
  }
});

test('backup import restores templates in replace mode', async () => {
  const { server, base } = await startServer();
  try {
    await createTemplate(base, { title: 'Keep A', tags: 'x' });
    await createTemplate(base, { title: 'Keep B', tags: 'y' });

    const exp = await fetch(`${base}/api/backup/export`);
    const buf = Buffer.from(await exp.arrayBuffer());

    const fd = new FormData();
    fd.set('backup', new Blob([buf], { type: 'application/zip' }), 'backup.zip');
    const res = await fetch(`${base}/api/backup/import?replace=1`, { method: 'POST', body: fd });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.ok(body.imported >= 2);
    assert.equal(body.errors.length, 0);

    const list = await (await fetch(`${base}/api/templates?pageSize=50`)).json();
    const restored = list.items.find((t) => t.title === 'Keep A');
    assert.ok(restored, 'restored template exists');
    assert.ok(restored.preview_dir, 'preview re-extracted');
    const files = await (await fetch(`${base}/api/templates/${restored.id}/files`)).json();
    assert.ok(files.length >= 1, 'files restored');
  } finally {
    server.close();
  }
});

test('backup import rejects a zip without a manifest', async () => {
  const { server, base } = await startServer();
  try {
    const bad = new AdmZip();
    bad.addFile('nope.txt', Buffer.from('hi'));
    const fd = new FormData();
    fd.set('backup', new Blob([bad.toBuffer()], { type: 'application/zip' }), 'bad.zip');
    const res = await fetch(`${base}/api/backup/import`, { method: 'POST', body: fd });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});
