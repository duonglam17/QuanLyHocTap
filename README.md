# LMS Mini - Hệ thống Quản lý Học tập (Backend)

Hệ thống quản lý học tập (LMS Mini) xây dựng theo kiến trúc **Modular Monolith** và **Clean Architecture (Layered)**, phục vụ 3 vai trò: Admin, Giảng viên và Sinh viên.

---

## 1. Yêu cầu Tiền đề (Prerequisites)

- **Node.js**: Phiên bản 20.x LTS trở lên (`node -v`)
- **Docker & Docker Compose**: Để chạy MySQL và toàn bộ dịch vụ cô lập (`docker -v`, `docker-compose -v`)
- **Git**

---

## 2. Khởi chạy Nhanh từ Máy trống (Quick Start with Docker)

### Bước 1: Sao chép tệp cấu hình môi trường
```powershell
cp .env.example .env
```

### Bước 2: Khởi động cơ sở dữ liệu và ứng dụng backend bằng Docker Compose
```powershell
docker-compose up -d --build
```
Lệnh này sẽ tự động:
1. Khởi chạy container MySQL 8.0 với múi giờ `Asia/Ho_Chi_Minh`, charset `utf8mb4`.
2. Áp dụng tuần tự 3 tệp migration của M1, M2, M3 từ `database/migrations/`.
3. Nạp dữ liệu mẫu ban đầu từ `database/seeds/`.
4. Khởi động ứng dụng backend Node.js tại cổng `5000`.

### Bước 3: Kiểm tra trạng thái dịch vụ
```powershell
# Kiểm tra Health Check
curl http://localhost:5000/api/health
```
Kết quả trả về:
```json
{
  "status": "healthy",
  "timestamp": "2026-10-21T...",
  "uptime": 12.34
}
```

---

## 3. Khởi chạy Cục bộ cho Phát triển (Local Development)

Nếu bạn muốn chạy trực tiếp mã nguồn backend trên máy tính (không qua container backend):

### Bước 1: Khởi động chỉ container MySQL
```powershell
docker-compose up -d mysql
```

### Bước 2: Chạy migration và nạp seed data
```powershell
# Chạy migration
node database/migrate.js

# Nạp dữ liệu mẫu
node database/seed.js
```

### Bước 3: Cài đặt thư viện backend và khởi động
```powershell
cd backend
npm install
npm run dev
```

---

## 4. Các Lệnh Script Chính trong `backend/`

Từ thư mục `backend/`:

| Lệnh | Mục đích |
|---|---|
| `npm run start` | Khởi chạy ứng dụng production (`node src/server.js`) |
| `npm run dev` | Khởi chạy chế độ phát triển với tự động tải lại (`nodemon src/server.js`) |
| `npm test` | Chạy bộ kiểm thử tự động (Health check & Tự nạp module) |
| `npm run lint` | Kiểm tra định dạng và quy chuẩn mã nguồn với ESLint |
| `npm run format` | Tự động định dạng mã với Prettier |
| `npm run deps:check` | Kiểm tra đồ thị phụ thuộc kiến trúc bằng `dependency-cruiser` (ngăn import vòng, cấm controller gọi trực tiếp repository) |

---

## 5. Cấu trúc Thư mục và Cơ chế Tự nạp Module (Autoloader)

```
backend/
├── src/
│   ├── app.js               # Express application & Cơ chế TỰ NẠP MODULES
│   ├── server.js            # Entry point & xử lý Graceful Shutdown
│   ├── common/              # Tầng dùng chung hạ tầng
│   │   ├── env.js           # Đọc và xác thực biến môi trường
│   │   ├── db.js            # MySQL Connection Pool
│   │   ├── logger.js        # Ghi log chuẩn hóa
│   │   ├── errors.js        # Định nghĩa các lớp lỗi AppError chuẩn
│   │   ├── errorHandler.js  # Xử lý lỗi thống nhất { code, message, details }
│   │   ├── authMiddleware.js# Middleware xác thực JWT (khung)
│   │   ├── rbacMiddleware.js# Middleware phân quyền RBAC (khung)
│   │   └── rateLimiter.js   # Giới hạn tần suất request (khung)
│   ├── contracts/           # Quy chuẩn giao tiếp giữa các module
│   │   └── README.md
│   └── modules/             # Các module nghiệp vụ độc lập
│       ├── m1-core/         # Module M1: Tài khoản, Khóa học, Bài giảng, Lịch học
│       ├── m2-assessment/   # Module M2: Bài tập tự luận & Bảng điểm
│       └── m3-quiz/         # Module M3: Đề thi trắc nghiệm, Tương tác & Thông báo
└── tests/                   # Bộ kiểm thử tự động
```

### Cơ chế Tự nạp Module:
`app.js` tự động quét thư mục `backend/src/modules/*/` khi khởi động. Mỗi module chỉ cần export một Express Router tại `index.js`. Hệ thống sẽ tự động mount router đó tại `/api/<tên-thư-mục>`.
- `GET /api/m1-core/ping` $\rightarrow$ Trả về `200 OK`
- `GET /api/m2-assessment/ping` $\rightarrow$ Trả về `200 OK`
- `GET /api/m3-quiz/ping` $\rightarrow$ Trả về `200 OK`

Khi một thành viên tạo module mới trong `modules/`, **hoàn toàn không cần sửa tệp `app.js`**, đảm bảo tính độc lập tuyệt đối giữa các thành viên.

