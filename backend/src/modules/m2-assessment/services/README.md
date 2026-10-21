# M2 - Services (Tầng Xử lý Nghiệp vụ)

Chứa toàn bộ logic nghiệp vụ đánh giá và tổng hợp điểm:

- `assignmentService.js`:
  - Kiểm tra hạn nộp trong tương lai (BR-07).
  - Kích hoạt thông báo tự động cho sinh viên khi có bài tập mới (Mục C.5).
- `submissionService.js`:
  - Kiểm tra dung lượng tệp <= 20MB và MIME whitelist (BR-07, BR-10).
  - So sánh thời điểm nộp với server deadline để gán cờ `is_late` và `late_minutes`.
  - Cơ chế nộp lại (In-place update, tăng `submission_count`, dọn tệp cũ EC-19).
  - Chống double submit (EC-04).
- `gradeService.js`:
  - Validate điểm số nằm trong đoạn [0.0, 10.0] bước nhảy 0.25 (BR-08, EC-16).
  - Kiểm tra quyền chấm điểm của giảng viên sở hữu khóa học (chống IDOR EC-01).
- `gradebookService.js`:
  - Tổng hợp điểm bài tập tự luận và gọi `QuizResultService` của Module M3 để lấy điểm thi trắc nghiệm.
  - Phân trang 20 sinh viên/trang và tối ưu câu truy vấn tránh lỗi N+1 (EC-21).
  - Sinh tệp CSV an toàn có UTF-8 BOM và escape công thức nguy hiểm (BR-16, EC-17).

