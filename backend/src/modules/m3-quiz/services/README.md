# M3 - Services (Tầng Xử lý Nghiệp vụ)

Chứa toàn bộ logic trắc nghiệm, thuật toán chấm điểm và tương tác lớp học:

- `quizService.js`:
  - Validate câu hỏi trắc nghiệm có 2-5 lựa chọn và đúng 1 đáp án đúng (BR-12, Mục C.3).
  - Kiểm tra điều kiện khóa sửa đề khi `has_attempts = true` (EC-07).
- `attemptService.js`:
  - Quản lý đồng hồ đếm ngược căn theo server time (`started_at`, `expires_at`, BR-14, EC-06).
  - Loại bỏ hoàn toàn trường `is_correct` khi gửi danh sách câu hỏi về client (BR-13, EC-02).
  - Quản lý session token chống làm bài trên 2 tab (EC-13).
  - Chấm điểm tự động và ghi nhận kết quả trong 1 Database Transaction duy nhất (NFR-08, EC-05).
  - Tính điểm theo công thức chuẩn hóa thang điểm 10 (Mục C.4).
- `quizResultService.js`:
  - **Dịch vụ công khai phục vụ Module M2:** Cung cấp hàm `getStudentQuizGrades(courseId, studentId)` để M2 tổng hợp vào bảng điểm mà không cần truy vấn trực tiếp bảng của M3.
- `communicationService.js`:
  - Sanitize chống mã độc Stored XSS trong tiêu đề, nội dung thông báo và thảo luận (BR-18, EC-11).

