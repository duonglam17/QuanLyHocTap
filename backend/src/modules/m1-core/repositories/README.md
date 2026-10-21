# M1 - Repositories (Tầng Truy vấn Dữ liệu CSDL)

Chứa toàn bộ câu lệnh SQL thao tác trực tiếp với CSDL MySQL của Module M1:

- `userRepository.js`: Thao tác bảng `users`, `roles`, `refresh_tokens`.
- `courseRepository.js`: Thao tác bảng `courses`, `enrollments`.
- `materialRepository.js`: Thao tác bảng `lessons`, `materials`.
- `scheduleRepository.js`: Thao tác bảng `schedules` (truy vấn theo ngày và kiểm tra xung đột thời gian).

*Lưu ý:* Repository chỉ thực hiện truy vấn và trả về dữ liệu thô, không chứa logic nghiệp vụ và không được gọi trực tiếp từ Controller.

