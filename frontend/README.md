# LMS Mini Frontend

Ứng dụng React 18, Vite, Tailwind CSS và các component dùng chung theo kiểu shadcn/ui. API dùng `/api`; Vite chuyển tiếp request sang backend trong môi trường phát triển.

## Chạy full-stack trên Windows

Yêu cầu Node.js 20+ và Docker Compose v2. Từ thư mục gốc repository, mở PowerShell:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Backend chạy tại `http://localhost:5000`. Để chạy Vite trực tiếp trong terminal thứ hai:

```powershell
Set-Location frontend
Copy-Item .env.example .env
npm ci
npm run dev
```

Mở URL Vite được in trong terminal (mặc định `http://localhost:5173`). `VITE_API_PROXY_TARGET` trong `frontend/.env` trỏ tới backend; `VITE_API_BASE_URL` mặc định là `/api`.

Nếu chạy backend trực tiếp thay vì Docker, làm theo hướng dẫn trong `backend/README.md`; cần MySQL và dữ liệu seed được nạp trước khi đăng nhập. Tài khoản trong `database/seeds/202611010900_m1_seed_core.sql`:

| Vai trò | Tên đăng nhập | Mật khẩu seed |
|---|---|---|
| Quản trị viên | `admin` | `MatKhau@123` |
| Giảng viên | `gv_mai` | `MatKhau@123` |
| Giảng viên | `gv_anv` | `MatKhau@123` |
| Sinh viên | `sv_nam` | `MatKhau@123` |
| Sinh viên | `sv_hoa` | `MatKhau@123` |

`sv_khoa` cũng có trong seed nhưng đang ở trạng thái `LOCKED`, nên không đăng nhập được.

## Lệnh kiểm tra

Chạy từ `frontend/`:

```powershell
npm run lint
npm test
npm run build
npm run deps:check
```

CI frontend chạy bốn lệnh trên khi có thay đổi trong `frontend/`.

## Thành phần và thư viện giao diện

- `@radix-ui/react-*`: primitive có hỗ trợ bàn phím và accessibility cho Avatar, Checkbox, Dialog/AlertDialog, DropdownMenu, Label, Popover, Select, Switch, Tabs và Tooltip. Thành phần được bọc trong `src/shared/components/atoms/`.
- `sonner`: thông báo toast dùng chung qua `toast.success` và `toast.error`.
- `lucide-react`: biểu tượng đã có trong scaffold và được tái sử dụng; không thêm thư viện biểu tượng khác.
- `class-variance-authority`, `clsx`, `tailwind-merge`: biến thể component và ghép class, đã có trong scaffold.
- Nút, trường nhập, textarea, badge, skeleton, spinner, bảng, phân trang và datetime-local dùng phần tử HTML chuẩn để tránh phụ thuộc không cần thiết.

## API dùng chung

```js
import { api } from '@/shared/api';

const result = await api.get('/courses', { params: { page: 1 } });
await api.post('/courses/1/assignments', { title: 'Bài tập' });
await api.upload('/assignments/1/submissions', formData, {
  onProgress: ({ percentage }) => setProgress(percentage)
});
await api.download('/submissions/1/download', { filename: 'bai-lam.pdf' });
```

Token được gắn tự động. Khi request được xác thực trả về 401, client thử xoay refresh token một lần theo ADR-04; nếu refresh thất bại, client xóa phiên và phát sự kiện `lms:unauthorized`. Chi tiết sử dụng component và token được ghi tại `docs/design-system.md` và `docs/architecture.md`.
