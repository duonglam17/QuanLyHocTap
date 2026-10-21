# LMS Mini - Hệ thống Quản lý Học tập Trực tuyến

Hệ thống quản lý học tập gọn nhẹ, tin cậy cho trường đại học, phục vụ việc quản lý khóa học, bài giảng, bài tập tự luận, thi trắc nghiệm và bảng điểm lớp học.

---

## 1. Cấu trúc Dự án
- `backend/`: Mã nguồn ứng dụng máy chủ (Node.js + Express) theo kiến trúc Modular Monolith.
- `database/`: Cơ sở dữ liệu MySQL 8.0, migration runner và scripts nạp dữ liệu mẫu theo module.
- `docs/`: Tài liệu PRD, flows, kiến trúc Clean Architecture, thiết kế CSDL và sơ đồ UML.
- `frontend/`: Ứng dụng Single Page Application (React 18 + Vite + Tailwind CSS + shadcn/ui).

---

## 2. Hướng dẫn Khởi chạy Khung Frontend

### Yêu cầu môi trường:
- **Node.js**: >= 18.0.0 (khuyến nghị Node.js 20 LTS)
- **npm**: >= 9.0.0

### Các lệnh thực thi chính:
Từ thư mục gốc dự án:

```powershell
# Di chuyển vào thư mục frontend
cd frontend

# Cài đặt toàn bộ dependencies
npm install

# Khởi chạy dev server (Vite)
npm run dev

# Chạy kiểm thử tự động (Vitest)
npm run test

# Kiểm tra chất lượng mã nguồn (ESLint)
npm run lint

# Định dạng mã nguồn (Prettier)
npm run format

# Đóng gói sản phẩm (Production Build)
npm run build
```

---

## 3. Kiến trúc Khung Frontend

### Cấu trúc phân tầng thư mục:
- `frontend/src/app/`: Khung tầng ứng dụng:
  - `layouts/`: Layout giao diện theo 3 vai trò (`AdminLayout`, `InstructorLayout`, `StudentLayout`) và `AuthLayout`.
  - `routes/`: Bộ bảo vệ phân quyền `RoleProtectedRoute`, bộ thu thập route tự động `routeCollector.js` và router trung tâm `router.jsx`.
- `frontend/src/shared/`: Hạ tầng dùng chung:
  - `styles/globals.css`: Thiết lập Design Tokens (màu ngữ nghĩa HSL: primary, secondary, destructive, muted, success, warning; radius).
  - `components/`: Kiến trúc Atomic Design (`atoms`, `molecules`, `organisms`, `templates`).
  - `api/apiClient.js`: Axios client trung tâm có Interceptor xử lý lỗi 401/403/404/422/5xx.
  - `hooks/useAsyncState.js`: Hook chuẩn hóa xử lý 3 trạng thái mạng Loading, Error (có Retry), Empty.
- `frontend/src/modules/`: Phân rã độc lập theo 3 module của 3 thành viên:
  - `m1/`: Nền tảng, Khóa học, Bài giảng, Lịch học (`routes.jsx`, `pages/M1PlaceholderPage.jsx`)
  - `m2/`: Bài tập, Chấm bài, Bảng điểm (`routes.jsx`, `pages/M2PlaceholderPage.jsx`)
  - `m3/`: Trắc nghiệm, Thông báo, Thảo luận (`routes.jsx`, `pages/M3PlaceholderPage.jsx`)

### Cơ chế Tự nạp Route (Dynamic Route Discovery):
- Router trung tâm sử dụng `import.meta.glob('../modules/**/routes.{jsx,js}')` để tự động thu thập và gắn kết toàn bộ routes từ các module.
- Thành viên phụ trách M1, M2 hoặc M3 chỉ cần thêm trang và khai báo trong file `routes.jsx` của module mình mà **không cần chỉnh sửa hay gây conflict tại router chung**.

