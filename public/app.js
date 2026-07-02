const grid = document.getElementById('grid');
const emptyMsg = document.getElementById('empty');
const pager = document.getElementById('pager');
const searchInput = document.getElementById('search');
const sortSelect = document.getElementById('sort');
const tagFilter = document.getElementById('tagFilter');

const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const form = document.getElementById('uploadForm');
const formError = document.getElementById('formError');
const archiveHint = document.getElementById('archiveHint');
const thumbHint = document.getElementById('thumbHint');

const detail = document.getElementById('detail');

const state = { q: '', tag: '', sort: 'newest', page: 1, pageSize: 12 };
let searchTimer = null;

// ---- Auth ----
const authBtn = document.getElementById('authBtn');
const auth = { required: false, token: localStorage.getItem('tv_token') || '' };

function authHeaders() {
  return auth.token ? { Authorization: `Bearer ${auth.token}` } : {};
}

async function checkAuth() {
  try {
    const res = await fetch('/api/auth');
    const data = await res.json();
    auth.required = Boolean(data.required);
  } catch { auth.required = false; }
  renderAuthBtn();
}

function renderAuthBtn() {
  if (!auth.required) { authBtn.hidden = true; return; }
  authBtn.hidden = false;
  authBtn.textContent = auth.token ? '🔓 Đăng xuất' : '🔒 Đăng nhập';
}

authBtn.onclick = () => {
  if (auth.token) {
    auth.token = '';
    localStorage.removeItem('tv_token');
  } else {
    const t = prompt('Nhập admin token:');
    if (t) { auth.token = t.trim(); localStorage.setItem('tv_token', auth.token); }
  }
  renderAuthBtn();
};

// Returns true if the response was a 401 (and prompts the user to log in).
function handleAuthError(res) {
  if (res.status === 401) {
    auth.token = '';
    localStorage.removeItem('tv_token');
    renderAuthBtn();
    alert('Cần đăng nhập (token không đúng hoặc đã hết hạn). Bấm "Đăng nhập" và nhập token.');
    return true;
  }
  return false;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function previewUrlOf(tpl) {
  return tpl.preview_dir && tpl.entry_file
    ? `/previews/${tpl.preview_dir}/${tpl.entry_file}`
    : null;
}

async function loadTags() {
  const res = await fetch('/api/tags');
  const tags = await res.json();
  tagFilter.innerHTML = '';
  tagFilter.appendChild(chip('Tất cả', ''));
  for (const t of tags) tagFilter.appendChild(chip(`${t.name} (${t.count})`, t.name));
}

function chip(label, value) {
  const el = document.createElement('button');
  el.className = 'chip' + (value === state.tag ? ' active' : '');
  el.textContent = label;
  el.onclick = () => { state.tag = value; state.page = 1; loadTags(); loadTemplates(); };
  return el;
}

async function loadTemplates() {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.tag) params.set('tag', state.tag);
  params.set('sort', state.sort);
  params.set('page', state.page);
  params.set('pageSize', state.pageSize);

  const res = await fetch('/api/templates?' + params.toString());
  const data = await res.json();
  state.page = data.page;

  grid.innerHTML = '';
  emptyMsg.hidden = data.items.length > 0;
  for (const tpl of data.items) grid.appendChild(card(tpl));
  renderPager(data);
}

function renderPager(data) {
  pager.innerHTML = '';
  if (data.pages <= 1) return;
  const mk = (label, page, disabled, active) => {
    const b = document.createElement('button');
    b.className = 'page-btn' + (active ? ' active' : '');
    b.textContent = label;
    b.disabled = disabled;
    b.onclick = () => { state.page = page; loadTemplates(); window.scrollTo({ top: 0 }); };
    return b;
  };
  pager.appendChild(mk('‹', data.page - 1, data.page <= 1));
  for (let p = 1; p <= data.pages; p++) pager.appendChild(mk(p, p, false, p === data.page));
  pager.appendChild(mk('›', data.page + 1, data.page >= data.pages));
}

function card(tpl) {
  const el = document.createElement('article');
  el.className = 'card';
  const thumbSrc = tpl.thumbnail ? `/thumbnails/${tpl.thumbnail}` : null;
  const previewUrl = previewUrlOf(tpl);

  el.innerHTML = `
    <div class="thumb">${thumbSrc ? `<img src="${thumbSrc}" alt="">` : '🖼️'}</div>
    <div class="card-body">
      <h3>${escapeHtml(tpl.title)}</h3>
      <p>${escapeHtml(tpl.description || '')}</p>
      <div class="card-tags">${tpl.tags.map((t) => `<span>${escapeHtml(t)}</span>`).join('')}</div>
    </div>
    <div class="card-actions">
      <button class="btn small info">Chi tiết</button>
      ${previewUrl ? `<a class="btn small" href="${previewUrl}" target="_blank">Preview</a>` : ''}
      <button class="btn small danger">Xóa</button>
    </div>
  `;

  el.querySelector('.thumb').onclick = () => openDetail(tpl.id);
  el.querySelector('.info').onclick = () => openDetail(tpl.id);
  el.querySelector('.danger').onclick = async () => {
    if (!confirm(`Xóa "${tpl.title}"?`)) return;
    const res = await fetch(`/api/templates/${tpl.id}`, { method: 'DELETE', headers: authHeaders() });
    if (handleAuthError(res)) return;
    loadTemplates();
    loadTags();
  };
  return el;
}

// ---- Detail modal ----
async function openDetail(id) {
  const res = await fetch(`/api/templates/${id}`);
  if (!res.ok) return;
  const tpl = await res.json();

  const thumb = document.getElementById('detailThumb');
  if (tpl.thumbnail) { thumb.src = `/thumbnails/${tpl.thumbnail}`; thumb.style.display = ''; }
  else { thumb.style.display = 'none'; }

  document.getElementById('detailTitle').textContent = tpl.title;
  document.getElementById('detailDesc').textContent = tpl.description || 'Không có mô tả.';
  document.getElementById('detailTags').innerHTML =
    tpl.tags.map((t) => `<span>${escapeHtml(t)}</span>`).join('') || '';
  document.getElementById('detailMeta').textContent =
    `Tạo lúc ${tpl.created_at} · ${tpl.downloads} lượt tải`;

  const previewUrl = previewUrlOf(tpl);
  const prev = document.getElementById('detailPreview');
  if (previewUrl) { prev.href = previewUrl; prev.style.display = ''; }
  else { prev.style.display = 'none'; }

  const dl = document.getElementById('detailDownload');
  if (tpl.archive_file) { dl.href = `/api/templates/${tpl.id}/download`; dl.style.display = ''; }
  else { dl.style.display = 'none'; }

  document.getElementById('detailEdit').onclick = () => { closeDetail(); openEdit(tpl); };

  // Files
  const filesBox = document.getElementById('detailFiles');
  filesBox.innerHTML = '<p class="muted">Đang tải...</p>';
  const fr = await fetch(`/api/templates/${tpl.id}/files`);
  const files = await fr.json();
  if (!files.length) {
    filesBox.innerHTML = '<p class="muted">Không có file (chưa upload zip).</p>';
  } else {
    filesBox.innerHTML = '';
    for (const f of files) filesBox.appendChild(fileRow(tpl.id, f));
  }

  detail.hidden = false;
}

function fileRow(templateId, f) {
  const row = document.createElement('div');
  row.className = 'file-row';
  const view = `/api/templates/${templateId}/file?path=${encodeURIComponent(f.path)}`;
  const dl = `${view}&download=1`;
  row.innerHTML = `
    <span class="file-name" title="${escapeHtml(f.path)}">${escapeHtml(f.path)}</span>
    <span class="file-size">${fmtSize(f.size)}</span>
    <span class="file-acts">
      <a class="mini" href="${view}" target="_blank">Xem</a>
      <a class="mini" href="${dl}">Tải</a>
      <button class="mini copy">Copy URL</button>
    </span>
  `;
  row.querySelector('.copy').onclick = async () => {
    const abs = new URL(view, window.location.origin).href;
    try { await navigator.clipboard.writeText(abs); flash(row.querySelector('.copy'), 'Đã copy'); }
    catch { prompt('Copy URL:', abs); }
  };
  return row;
}

function flash(btn, text) {
  const old = btn.textContent;
  btn.textContent = text;
  setTimeout(() => { btn.textContent = old; }, 1200);
}

function closeDetail() { detail.hidden = true; }
document.getElementById('detailClose').onclick = closeDetail;
detail.onclick = (e) => { if (e.target === detail) closeDetail(); };

// ---- Upload / Edit modal ----
function openCreate() {
  form.reset();
  form.id.value = '';
  modalTitle.textContent = 'Thêm template';
  archiveHint.textContent = '';
  thumbHint.textContent = '';
  form.title.disabled = false;
  formError.hidden = true;
  modal.hidden = false;
}

function openEdit(tpl) {
  form.reset();
  form.id.value = tpl.id;
  modalTitle.textContent = 'Sửa template';
  form.title.value = tpl.title;
  form.description.value = tpl.description || '';
  form.tags.value = tpl.tags.join(', ');
  archiveHint.textContent = tpl.archive_file ? '(để trống nếu giữ file cũ)' : '';
  thumbHint.textContent = tpl.thumbnail ? '(để trống nếu giữ ảnh cũ)' : '';
  formError.hidden = true;
  modal.hidden = false;
}

document.getElementById('openUpload').onclick = openCreate;
document.getElementById('cancelUpload').onclick = () => { modal.hidden = true; };
modal.onclick = (e) => { if (e.target === modal) modal.hidden = true; };

form.onsubmit = async (e) => {
  e.preventDefault();
  formError.hidden = true;
  const id = form.id.value;
  const data = new FormData(form);
  data.delete('id');
  // Drop empty file inputs so PATCH keeps existing files.
  if (!form.archive.files.length) data.delete('archive');
  if (!form.thumbnail.files.length) data.delete('thumbnail');

  const url = id ? `/api/templates/${id}` : '/api/templates';
  const method = id ? 'PATCH' : 'POST';
  const res = await fetch(url, { method, body: data, headers: authHeaders() });
  if (res.status === 401) {
    handleAuthError(res);
    formError.textContent = 'Cần đăng nhập. Bấm "Đăng nhập" ở góc trên rồi thử lại.';
    formError.hidden = false;
    return;
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    formError.textContent = body.error || 'Có lỗi khi lưu template.';
    formError.hidden = false;
    return;
  }
  modal.hidden = true;
  await loadTags();
  await loadTemplates();
};

// ---- Backup export / import ----
document.getElementById('exportBtn').onclick = async () => {
  const res = await fetch('/api/backup/export', { headers: authHeaders() });
  if (handleAuthError(res)) return;
  if (!res.ok) { alert('Export thất bại.'); return; }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 10);
  a.download = `template-vault-backup-${stamp}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const importFile = document.getElementById('importFile');
document.getElementById('importBtn').onclick = () => importFile.click();
importFile.onchange = async () => {
  const file = importFile.files[0];
  if (!file) return;
  const replace = confirm(
    'Khôi phục dữ liệu từ backup.\n\nOK = THAY THẾ toàn bộ dữ liệu hiện tại.\nCancel = GỘP thêm vào dữ liệu hiện có.'
  );
  const data = new FormData();
  data.set('backup', file);
  const url = '/api/backup/import' + (replace ? '?replace=1' : '');
  const res = await fetch(url, { method: 'POST', body: data, headers: authHeaders() });
  importFile.value = '';
  if (handleAuthError(res)) return;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) { alert(body.error || 'Import thất bại.'); return; }
  alert(`Đã nhập ${body.imported}/${body.total} template.` + (body.errors?.length ? `\nLỗi: ${body.errors.length}` : ''));
  await loadTags();
  await loadTemplates();
};

// ---- Controls ----
searchInput.oninput = () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.q = searchInput.value.trim(); state.page = 1; loadTemplates(); }, 250);
};
sortSelect.onchange = () => { state.sort = sortSelect.value; state.page = 1; loadTemplates(); };

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { modal.hidden = true; closeDetail(); }
});

loadTags();
loadTemplates();
checkAuth();
