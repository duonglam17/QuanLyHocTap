# M1 - Services (Tầng Xử lý Nghiệp vụ)

Chứa toàn bộ quy tắc nghiệp vụ (Business Rules) của Module M1:

- `authService.js`:
  - Mã hóa/so sánh mật khẩu bcrypt.
  - Xử lý khóa tạm 15 phút khi nhập sai 5 lần liên tiếp (BR-02, EC-08).
  - Cấp phát JWT Access Token và Refresh Token (ADR-04).
  - Thu hồi phiên tức thì qua `token_version` khi bị khóa (US-02).
- `userService.js`: Tạo người dùng mới, kiểm tra trùng lặp email/username, cập nhật trạng thái.
- `courseService.js`:
  - Sinh mã Enrollment Key duy nhất 6-8 ký tự (BR-04).
  - Kiểm tra điều kiện xuất bản và ghi danh (BR-05).
  - Cung cấp hàm công khai `validateEnrollment(courseId, studentId)` cho M2 và M3.
- `materialService.js`:
  - Kiểm tra MIME type và magic bytes của tệp tải lên (BR-10, NFR-07).
  - Đổi tên tệp thành UUID v4.
  - Quản lý stream tải tệp an toàn chống IDOR (BR-11, EC-18).
- `scheduleService.js`:
  - Kiểm tra ràng buộc thời gian `start_time < end_time` (BR-19).
  - Thuật toán kiểm tra trùng lặp khung giờ trong cùng khóa học (EC-23).

