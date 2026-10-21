# Frontend - LMS Mini Client Application

Ứng dụng Frontend xây dựng theo kiến trúc Single Page Application (SPA) với **React 18**, **Vite**, **Tailwind CSS** và các nguyên tắc thiết kế **Atomic Design** & **Design Tokens**.

---

## 1. Cấu trúc Thư mục

```
frontend/
├── index.html                     # HTML Template chính
├── package.json                   # Cấu hình dependencies và npm scripts
├── vite.config.js                 # Cấu hình Vite & Vitest (alias @ -> src)
├── tailwind.config.js             # Cấu hình Design Tokens ngữ nghĩa
├── postcss.config.js              # PostCSS plugins (Tailwind, Autoprefixer)
├── .eslintrc.cjs                  # Cấu hình ESLint chuẩn React 18
├── .prettierrc                    # Cấu hình định dạng mã nguồn Prettier
├── src/
│   ├── main.jsx                   # Entry point ứng dụng
│   ├── app/                       # Tầng ứng dụng trung tâm
│   │   ├── App.jsx                # Root Component kết nối RouterProvider
│   │   ├── layouts/               # Layout theo vai trò: Admin, Instructor, Student, Auth
│   │   ├── pages/                 # Trang hệ thống: LoginPage, NotFoundPage, HomePage
│   │   └── routes/                # Router trung tâm, RoleProtectedRoute, routeCollector
│   ├── shared/                    # Hạ tầng dùng chung
│   │   ├── api/                   # apiClient.js (xử lý mã lỗi 401, 403, 404, 422, 5xx)
│   │   ├── hooks/                 # useAsyncState.js (Loading, Error, Empty)
│   │   ├── lib/                   # utils.js (hàm cn merge class Tailwind)
│   │   ├── styles/                # globals.css (biến CSS Design Tokens)
│   │   └── components/            # Atomic Design
│   │       ├── atoms/             # Button, Input, Badge, Spinner
│   │       ├── molecules/         # StateHandler (Loading/Error/Empty), FormField
│   │       ├── organisms/         # AppHeader, RoleSidebar
│   │       └── templates/         # BasePageLayout
│   ├── modules/                   # 3 Module nghiệp vụ độc lập
│   │   ├── m1/                    # Module 1 (Tài khoản, Khóa học, Lịch học)
│   │   │   ├── pages/M1PlaceholderPage.jsx
│   │   │   └── routes.jsx
│   │   ├── m2/                    # Module 2 (Bài tập, Chấm bài, Bảng điểm)
│   │   │   ├── pages/M2PlaceholderPage.jsx
│   │   │   └── routes.jsx
│   │   └── m3/                    # Module 3 (Trắc nghiệm, Thông báo, Thảo luận)
│   │       ├── pages/M3PlaceholderPage.jsx
│   │       └── routes.jsx
│   └── test/                      # Cấu hình kiểm thử setup.js
```

---

## 2. Các Lệnh Thực thi (Scripts)

```powershell
# Chạy môi trường phát triển (HMR)
npm run dev

# Kiểm thử tự động (Vitest)
npm run test

# Kiểm tra lỗi cú pháp và chuẩn code (ESLint)
npm run lint

# Tự động sửa lỗi cú pháp nếu được
npm run lint:fix

# Định dạng mã nguồn theo Prettier
npm run format

# Đóng gói sản phẩm chạy production
npm run build
```

---

## 3. Hướng dẫn Mở rộng Trang Mới cho Từng Module

Mỗi thành viên khi phát triển module của mình (M1, M2 hoặc M3) **chỉ làm việc trong thư mục `src/modules/<tên-module>/`**:
1. Tạo component trang mới trong `src/modules/<tên-module>/pages/`.
2. Khai báo route trong `src/modules/<tên-module>/routes.jsx` theo định dạng:
   ```javascript
   {
     path: '/<role>/<ten-tinh-nang>',
     role: 'ADMIN' | 'GIANG_VIEN' | 'SINH_VIEN',
     element: <MyNewPage />,
   }
   ```
3. Bộ thu thập route (`routeCollector.js`) sẽ tự động phát hiện và tích hợp trang vào menu phân quyền mà **không làm thay đổi file router chung của dự án**.

