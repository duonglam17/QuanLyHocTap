# M2 - Repositories (Tầng Truy vấn Dữ liệu CSDL)

Chứa toàn bộ câu lệnh SQL thao tác với các bảng thuộc Module M2:

- `assignmentRepository.js`: Thao tác bảng `assignments`.
- `assessmentUsageRepository.js`: Cung cấp Port `assessmentUsage` bằng các truy vấn `EXISTS` trên bảng bài tập, bài nộp và điểm.
- `submissionRepository.js`: Thao tác bảng `submissions` (sử dụng `SELECT ... FOR UPDATE` khi xử lý nộp bài chống race condition).
- `gradeRepository.js`: Thao tác bảng `grades`.
- `gradebookRepository.js`: Truy vấn gộp phân trang danh sách sinh viên và bảng điểm (kết hợp `IN (?)` tối ưu).

*Lưu ý:* Module M2 không truy vấn trực tiếp vào các bảng `quizzes` hay `attempts` của M3, mà phải gọi thông qua `QuizResultService` của M3.
