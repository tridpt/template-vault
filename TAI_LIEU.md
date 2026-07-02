# Tài liệu dự án Template Vault

> Tài liệu kỹ thuật chi tiết cho ứng dụng web lưu trữ, gắn thẻ, tìm kiếm và xem trước các mẫu web (web template).

---

## 1. Giới thiệu tổng quan

**Template Vault** là một ứng dụng web giúp bạn xây dựng một kho lưu trữ các mẫu web (HTML/CSS/JS) cá nhân. Bạn tải lên mẫu dưới dạng file `.zip`, gắn thẻ (tag) và mô tả, sau đó có thể tìm kiếm, lọc, xem trước trực tiếp trong trình duyệt, tải về, sửa hoặc xóa.

Điểm chính:

- **Database thật** bằng SQLite — dữ liệu bền vững qua các lần khởi động lại.
- **Xem trước trực tiếp** (live preview): file zip được tự động giải nén và phục vụ như một trang web chạy được, không cần tải về.
- **Tìm kiếm và lọc** theo tên, mô tả và thẻ; có phân trang và sắp xếp.
- **Sao lưu / khôi phục** toàn bộ kho ra một file zip duy nhất.
- **Xác thực tùy chọn**: mặc định mở (tiện chạy local), bật token khi cần bảo vệ.

Ứng dụng chạy hoàn toàn cục bộ (localhost), không phụ thuộc dịch vụ ngoài.

---

## 2. Tính năng

| Nhóm | Tính năng |
| --- | --- |
| Quản lý mẫu | Tải lên mẫu `.zip` kèm ảnh thumbnail, mô tả và danh sách thẻ |
| Chỉnh sửa | Sửa tên/mô tả/thẻ, thay file zip hoặc thumbnail (giữ file cũ nếu để trống) |
| Xóa | Xóa mẫu kèm dọn dẹp file, thư mục preview và thẻ mồ côi |
| Tìm kiếm | Tìm theo tên và mô tả (`?q=`) |
| Lọc theo thẻ | Lọc mẫu theo một thẻ (`?tag=`), kèm bảng đếm số lượng mỗi thẻ |
| Sắp xếp | Mới nhất, cũ nhất, tên A→Z, tải nhiều nhất |
| Phân trang | Trả về envelope `{ items, total, page, pageSize, pages, sort }` |
| Xem trước | Live preview chạy trực tiếp trong iframe/tab từ thư mục đã giải nén |
| Chi tiết | Modal chi tiết: mô tả đầy đủ, thẻ, ngày tạo, lượt tải, danh sách file trong zip |
| Thao tác file | Liệt kê từng file trong mẫu; xem, tải hoặc copy URL từng file riêng lẻ |
| Tải về | Tải cả file zip gốc; tự tăng bộ đếm lượt tải |
| Sao lưu | Xuất toàn bộ kho ra 1 zip (manifest + file); nhập lại theo chế độ replace hoặc merge |
| Xác thực | Tùy chọn qua `ADMIN_TOKEN`; đọc công khai, ghi cần token |
| Bảo mật | Chống zip-slip khi giải nén, chống path-traversal khi phục vụ file |
| Vận hành | Script chạy nền (Windows), Docker + docker-compose, bộ test tự động |

---

## 3. Công nghệ sử dụng

- **Node.js** (>= 22) — môi trường chạy. Dùng `process.loadEnvFile()` để nạp `.env` (tính năng của Node 22).
- **Express 4** — phục vụ HTTP, file tĩnh và API.
- **better-sqlite3** — database SQLite đồng bộ, nhúng trong tiến trình (native module).
- **multer** (2.x) — xử lý upload file multipart (disk storage cho mẫu, memory storage cho backup).
- **adm-zip** — giải nén và đóng gói file zip (preview, sao lưu/khôi phục).
- **node:test** — bộ kiểm thử tích hợp sẵn của Node, không cần thư viện ngoài.
- **Frontend** — HTML/CSS/JavaScript thuần (vanilla), không framework.

---

## 4. Cấu trúc thư mục

```
template-vault/
├── src/
│   ├── index.js              # Khởi tạo app Express (factory createApp) + khởi động server
│   ├── db.js                 # Kết nối SQLite, tạo bảng, migration cột downloads
│   ├── paths.js              # Đường dẫn thư mục lưu trữ (uploads/thumbnails/previews)
│   ├── store.js              # Toàn bộ truy vấn DB: CRUD mẫu, thẻ, phân trang, backup
│   ├── archive.js            # Tiện ích zip: giải nén an toàn, tìm file entry, liệt kê file
│   ├── middleware/
│   │   └── auth.js           # Xác thực tùy chọn qua ADMIN_TOKEN
│   └── routes/
│       ├── templates.js      # API CRUD mẫu, file, download, tags, auth-status
│       └── backup.js         # API export/import sao lưu
├── public/
│   ├── index.html            # Giao diện gallery
│   ├── app.js                # Logic frontend (fetch API, modal, phân trang, auth)
│   └── style.css             # Giao diện (dark theme)
├── scripts/
│   ├── run-template-vault.cmd    # Chạy server hiện console (xem log trực tiếp)
│   ├── start-template-vault.vbs  # Chạy nền không cửa sổ
│   └── stop-template-vault.cmd   # Tắt server trên port 4000
├── test/
│   ├── setup.js              # Trỏ DATA_DIR/STORAGE_DIR vào thư mục tạm
│   └── templates.test.js     # 17 test cho toàn bộ API
├── data/                     # (git-ignored) file database SQLite
├── storage/                  # (git-ignored) uploads, thumbnails, previews đã giải nén
├── Dockerfile                # Image multi-stage (node:22-slim)
├── docker-compose.yml        # Chạy kèm volume cho data + storage
├── .dockerignore
├── .gitignore
├── .env.example              # Mẫu biến môi trường
├── package.json
├── README.md                 # Hướng dẫn ngắn (tiếng Anh)
└── TAI_LIEU.md               # Tài liệu chi tiết này
```

---

## 5. Mô hình dữ liệu

Database SQLite (`data/templates.db`) chạy ở chế độ WAL với `foreign_keys = ON`. Gồm 3 bảng:

### Bảng `templates`

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| `id` | INTEGER PK | Tự tăng |
| `title` | TEXT | Bắt buộc, tên mẫu |
| `description` | TEXT | Mặc định rỗng |
| `slug` | TEXT UNIQUE | Sinh từ title, tự thêm hậu tố số nếu trùng |
| `archive_file` | TEXT | Tên file zip gốc trong `storage/uploads` |
| `thumbnail` | TEXT | Tên file ảnh trong `storage/thumbnails` |
| `preview_dir` | TEXT | Tên thư mục đã giải nén trong `storage/previews` |
| `entry_file` | TEXT | Đường dẫn tương đối tới file HTML để preview |
| `created_at` | TEXT | Mặc định `datetime('now')` |
| `downloads` | INTEGER | Bộ đếm lượt tải, thêm qua migration, mặc định 0 |

### Bảng `tags`

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| `id` | INTEGER PK | Tự tăng |
| `name` | TEXT UNIQUE | Tên thẻ, đã chuẩn hóa về chữ thường |

### Bảng `template_tags` (nối nhiều-nhiều)

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| `template_id` | INTEGER FK | → `templates(id)`, `ON DELETE CASCADE` |
| `tag_id` | INTEGER FK | → `tags(id)`, `ON DELETE CASCADE` |

Khóa chính ghép `(template_id, tag_id)`, có index `idx_template_tags_tag`. Thẻ mồ côi (không còn mẫu nào dùng) được tự động dọn sau khi sửa/xóa.

**Chuẩn hóa thẻ:** tách theo dấu phẩy, trim, chuyển chữ thường, loại trùng và loại rỗng.

**Migration:** khi khởi động, nếu bảng `templates` chưa có cột `downloads` thì tự `ALTER TABLE` thêm vào — an toàn với database cũ.

---

## 6. Tham chiếu API

Tất cả endpoint có tiền tố `/api`. Các thao tác **ghi** (POST/PATCH/DELETE, export/import) yêu cầu token khi `ADMIN_TOKEN` được đặt; thao tác **đọc** luôn công khai.

### Đọc (công khai)

| Method | Đường dẫn | Mô tả |
| --- | --- | --- |
| `GET` | `/api/templates` | Danh sách phân trang. Query: `q`, `tag`, `sort`, `page`, `pageSize` |
| `GET` | `/api/templates/:id` | Chi tiết một mẫu |
| `GET` | `/api/templates/:id/files` | Liệt kê file trong mẫu (đường dẫn + kích thước) |
| `GET` | `/api/templates/:id/file?path=` | Xem/tải một file lẻ (`&download=1` để tải) |
| `GET` | `/api/templates/:id/download` | Tải file zip gốc, tăng bộ đếm downloads |
| `GET` | `/api/tags` | Danh sách thẻ kèm số lượng |
| `GET` | `/api/auth` | Cho biết có cần token để ghi không (`{ required: bool }`) |

**Tham số `sort`:** `newest` (mặc định), `oldest`, `title`, `downloads`.
**Phân trang:** `pageSize` giới hạn 1–60 (mặc định 12). Trả về `{ items, total, page, pageSize, pages, sort }`.

### Ghi (cần token khi bật auth)

| Method | Đường dẫn | Mô tả |
| --- | --- | --- |
| `POST` | `/api/templates` | Tạo mẫu. Multipart: `archive`, `thumbnail`, `title`, `description`, `tags` |
| `PATCH` | `/api/templates/:id` | Sửa mẫu. Trường/file để trống thì giữ nguyên giá trị cũ |
| `DELETE` | `/api/templates/:id` | Xóa mẫu và toàn bộ file liên quan |
| `GET` | `/api/backup/export` | Tải về 1 zip: `manifest.json` + tất cả archive/thumbnail |
| `POST` | `/api/backup/import` | Khôi phục từ zip. `?replace=1` xóa sạch trước; mặc định gộp thêm |

**Giới hạn upload:** 50 MB mỗi file cho mẫu/thumbnail; 500 MB cho file backup.
**Kiểu file:** `archive` phải là `.zip`; `thumbnail` phải là ảnh (`png/jpg/jpeg/gif/webp/svg`).

### Cách gửi token

Một trong hai:
- Header `Authorization: Bearer <token>`
- Header `x-admin-token: <token>`

---

## 7. Cấu hình (biến môi trường)

Nạp tự động từ file `.env` ở thư mục gốc nếu có.

| Biến | Mặc định | Mô tả |
| --- | --- | --- |
| `PORT` | `4000` | Cổng HTTP |
| `ADMIN_TOKEN` | *(rỗng)* | Đặt để bật xác thực cho các thao tác ghi. Rỗng = app mở hoàn toàn |
| `DATA_DIR` | `./data` | Thư mục chứa file database SQLite |
| `STORAGE_DIR` | `./storage` | Thư mục chứa uploads/thumbnails/previews |

---

## 8. Cách chạy

### Chạy trực tiếp

```bash
npm install
npm start          # hoặc: npm run dev  (tự reload khi sửa code)
```

Mở http://localhost:4000

### Chạy nền trên Windows

- Bấm đúp `scripts/start-template-vault.vbs` — chạy nền, không cửa sổ, log vào `logs/server.*.log`.
- Bấm đúp `scripts/stop-template-vault.cmd` — tắt server.
- `scripts/run-template-vault.cmd` — chạy hiện console để xem log trực tiếp.
- Tự chạy khi khởi động máy: đặt shortcut của file `.vbs` vào thư mục `shell:startup` (Win+R → `shell:startup`).

### Chạy bằng Docker

```bash
docker compose up --build
```

`docker-compose.yml` mount `./data` và `./storage` làm volume để dữ liệu bền qua các lần rebuild, và truyền `ADMIN_TOKEN` từ file `.env`.

---

## 9. Bảo mật

- **Chống zip-slip:** khi giải nén, mọi entry được kiểm tra để không thoát khỏi thư mục đích. Entry có đường dẫn nguy hiểm sẽ bị từ chối và mẫu không được tạo.
- **Chống path-traversal:** endpoint phục vụ file lẻ giải và kiểm tra đường dẫn tuyệt đối, chặn `../` thoát khỏi thư mục preview.
- **So sánh token an toàn:** dùng `crypto.timingSafeEqual` để tránh timing attack.
- **Xác thực opt-in:** phù hợp chạy local (mở) hoặc deploy (bật token). Lưu ý: preview phục vụ HTML tùy ý người dùng tải lên — với kho cá nhân thì an toàn, nhưng nếu mở cho nhiều người dùng chung thì file HTML lạ có thể chạy script trong trình duyệt.

---

## 10. Kiểm thử

```bash
npm test
```

Chạy bằng `node --test`. File `test/setup.js` trỏ `DATA_DIR` và `STORAGE_DIR` vào thư mục tạm nên test **không đụng** vào `data/` hay `storage/` thật. `src/index.js` tách thành factory `createApp()` để test khởi động server trên cổng ngẫu nhiên.

Bộ test (17 test) bao phủ: tạo mẫu + giải nén, chặn thiếu tên/file sai định dạng, phân trang + sắp xếp, liệt kê file, xem file lẻ + chặn path-traversal, tăng bộ đếm tải, PATCH sửa trường và thay zip, xóa, đếm thẻ, xác thực (chặn/cho phép/token sai), và export/import backup (cả replace lẫn merge).
