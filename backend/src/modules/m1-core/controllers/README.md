# M1 - Controllers (Tầng Điều hướng & Tiếp nhận Request)

Chứa các Controller phụ trách nhận HTTP request, xác thực dữ liệu đầu vào (validation) và gọi Service tương ứng:

- `authController.js`: Đăng nhập, đăng xuất, đổi mật khẩu lần đầu (US-01).
- `userController.js`: Quản lý danh sách người dùng, tạo tài khoản, khóa/mở tài khoản bởi Admin (US-02).
- `courseController.js`: Tạo khóa học, sinh mã ghi danh, xuất bản khóa học, ghi danh bằng mã (US-03, US-04).
- `materialController.js`: Đăng tải và tải tệp tài liệu bài giảng an toàn (US-05, US-06).
- `scheduleController.js`: Thiết lập và quản lý lịch học, thời khóa biểu (US-17, US-18).

