# M3 - Controllers (Tầng Điều hướng & Tiếp nhận Request)

Chứa các Controller phụ trách nhận request cho phân hệ Trắc nghiệm và Tương tác:

- `quizController.js`: Tạo đề thi trắc nghiệm, quản lý câu hỏi/lựa chọn, khóa sửa đề khi đã có sinh viên thi (US-10).
- `attemptController.js`:
  - Sinh viên bắt đầu làm bài thi, cấp session token chống mở 2 tab (US-11).
  - Tự động lưu đáp án ngầm (auto-save) và khôi phục khi F5 (US-11).
  - Nộp bài thi và nhận kết quả điểm tức thì (US-12).
- `announcementController.js`: Đăng thông báo khóa học (US-15).
- `discussionController.js`: Gửi bình luận và phản hồi thảo luận bài học (US-16).
- `notificationController.js`: Lấy danh sách thông báo và đánh dấu đã đọc (US-07, US-15).

