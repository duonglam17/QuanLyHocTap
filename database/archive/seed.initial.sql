-- =============================================================================
-- HỆ THỐNG QUẢN LÝ HỌC TẬP (LMS MINI)
-- DATABASE INITIAL SEED DATA
-- Mật khẩu mặc định cho toàn bộ tài khoản mẫu: MatKhau@123
-- Hash: $2b$10$5M8yvVbYVjNknbYI6n8PtuZ4gZqY4m4FqFkY0jO8y3tQ3yO0h9Oqu (BCrypt 10 rounds)
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+07:00';
SET foreign_key_checks = 0;

-- 1. SEED ROLES
INSERT INTO `roles` (`id`, `name`, `description`) VALUES
(1, 'ADMIN', 'Quản trị viên toàn hệ thống'),
(2, 'GIANG_VIEN', 'Giảng viên phụ trách môn học và khóa học'),
(3, 'SINH_VIEN', 'Sinh viên tham gia học tập, nộp bài và thi cử')
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

-- 2. SEED USERS
-- 1 Admin (admin), 2 Giảng viên (gv_mai, gv_anv), 3 Sinh viên (sv_nam, sv_hoa, sv_khoa)
INSERT INTO `users` (`id`, `role_id`, `username`, `email`, `password_hash`, `full_name`, `status`, `token_version`, `must_change_password`, `created_at`) VALUES
(1, 1, 'admin', 'admin@lms.edu.vn', '$2b$10$5M8yvVbYVjNknbYI6n8PtuZ4gZqY4m4FqFkY0jO8y3tQ3yO0h9Oqu', 'Quản trị viên Hoàng', 'ACTIVE', 1, FALSE, NOW()),
(2, 2, 'gv_mai', 'mai.nguyen@lms.edu.vn', '$2b$10$5M8yvVbYVjNknbYI6n8PtuZ4gZqY4m4FqFkY0jO8y3tQ3yO0h9Oqu', 'Cô Nguyễn Thị Mai', 'ACTIVE', 1, FALSE, NOW()),
(3, 2, 'gv_anv', 'anv.le@lms.edu.vn', '$2b$10$5M8yvVbYVjNknbYI6n8PtuZ4gZqY4m4FqFkY0jO8y3tQ3yO0h9Oqu', 'Thầy Lê Văn An', 'ACTIVE', 1, FALSE, NOW()),
(4, 3, 'sv_nam', 'nam.tran@lms.edu.vn', '$2b$10$5M8yvVbYVjNknbYI6n8PtuZ4gZqY4m4FqFkY0jO8y3tQ3yO0h9Oqu', 'Trần Văn Nam', 'ACTIVE', 1, FALSE, NOW()),
(5, 3, 'sv_hoa', 'hoa.pham@lms.edu.vn', '$2b$10$5M8yvVbYVjNknbYI6n8PtuZ4gZqY4m4FqFkY0jO8y3tQ3yO0h9Oqu', 'Phạm Thị Hoa', 'ACTIVE', 1, FALSE, NOW()),
(6, 3, 'sv_khoa', 'khoa.dang@lms.edu.vn', '$2b$10$5M8yvVbYVjNknbYI6n8PtuZ4gZqY4m4FqFkY0jO8y3tQ3yO0h9Oqu', 'Đặng Đăng Khoa', 'LOCKED', 1, FALSE, NOW())
ON DUPLICATE KEY UPDATE `username`=VALUES(`username`);

-- 3. SEED COURSE
INSERT INTO `courses` (`id`, `code`, `title`, `description`, `semester`, `instructor_id`, `enrollment_key`, `status`, `created_at`) VALUES
(1, 'INT3101', 'Lập trình Web nâng cao', 'Học phần phát triển ứng dụng Web hiện đại với REST API và Single Page Application', 'HK1-2026', 2, 'WEB2026', 'PUBLISHED', NOW())
ON DUPLICATE KEY UPDATE `code`=VALUES(`code`);

-- 4. SEED ENROLLMENTS (Sinh viên sv_nam và sv_hoa ghi danh vào khóa học 1)
INSERT INTO `enrollments` (`id`, `course_id`, `student_id`, `enrolled_at`) VALUES
(1, 1, 4, NOW()),
(2, 1, 5, NOW())
ON DUPLICATE KEY UPDATE `course_id`=VALUES(`course_id`);

-- 5. SEED LESSONS & MATERIALS
INSERT INTO `lessons` (`id`, `course_id`, `title`, `content`, `order_index`, `created_at`) VALUES
(1, 1, 'Chương 1: Tổng quan Kiến trúc Web & RESTful API', 'Giới thiệu các thành phần kiến trúc web, HTTP protocol, và nguyên tắc thiết kế REST API.', 1, NOW()),
(2, 1, 'Chương 2: Thiết kế Cơ sở dữ liệu Chuẩn hóa 3NF', 'Quy tắc chuẩn hóa 1NF, 2NF, 3NF và kỹ thuật lập chỉ mục tối ưu truy vấn.', 2, NOW())
ON DUPLICATE KEY UPDATE `title`=VALUES(`title`);

INSERT INTO `materials` (`id`, `lesson_id`, `title`, `original_filename`, `file_uuid`, `file_path`, `file_size_bytes`, `mime_type`, `uploaded_at`) VALUES
(1, 1, 'Slide Bài giảng Chương 1', 'slides_chuong1.pdf', 'mat-uuid-1111-2222-3333-444455556666.pdf', '/app/uploads/materials/mat-uuid-1111-2222-3333-444455556666.pdf', 5242880, 'application/pdf', NOW())
ON DUPLICATE KEY UPDATE `title`=VALUES(`title`);

-- 6. SEED SCHEDULES (Lịch học)
INSERT INTO `schedules` (`id`, `course_id`, `title`, `date`, `start_time`, `end_time`, `room_or_link`, `status`, `created_at`) VALUES
(1, 1, 'Buổi 1: Giới thiệu môn học & Thiết lập môi trường', '2026-11-10', '08:00:00', '11:30:00', 'Phòng máy B302', 'SCHEDULED', NOW()),
(2, 1, 'Buổi 2: Thực hành RESTful API với Node.js & MySQL', '2026-11-17', '08:00:00', '11:30:00', 'Phòng máy B302', 'SCHEDULED', NOW())
ON DUPLICATE KEY UPDATE `title`=VALUES(`title`);

-- 7. SEED ASSIGNMENT & SUBMISSION
INSERT INTO `assignments` (`id`, `course_id`, `title`, `description`, `deadline`, `max_score`, `allow_late`, `status`, `created_at`) VALUES
(1, 1, 'Bài tập lớn 1: Thiết kế Database & API Contract', 'Yêu cầu: Thiết kế ERD, viết schema.sql chuẩn MySQL và tài liệu OpenAPI 3.0. Nộp báo cáo PDF hoặc mã nguồn ZIP.', '2026-11-30 23:59:59', 10.00, TRUE, 'OPEN', NOW())
ON DUPLICATE KEY UPDATE `title`=VALUES(`title`);

-- Sinh viên sv_nam đã nộp bài tập 1
INSERT INTO `submissions` (`id`, `assignment_id`, `student_id`, `original_filename`, `file_uuid`, `file_path`, `file_size_bytes`, `mime_type`, `submitted_at`, `is_late`, `late_minutes`, `submission_count`, `status`, `created_at`) VALUES
(1, 1, 4, 'BaoCao_Nam_Nhom3.pdf', 'sub-uuid-7777-8888-9999-aaaabbbbcccc.pdf', '/app/uploads/submissions/sub-uuid-7777-8888-9999-aaaabbbbcccc.pdf', 2097152, 'application/pdf', NOW(), FALSE, 0, 1, 'GRADED', NOW())
ON DUPLICATE KEY UPDATE `original_filename`=VALUES(`original_filename`);

-- Điểm và nhận xét của giảng viên gv_mai cho bài nộp của sv_nam
INSERT INTO `grades` (`id`, `submission_id`, `graded_by`, `score`, `feedback`, `graded_at`) VALUES
(1, 1, 2, 8.50, 'Báo cáo trình bày rất tốt, cấu trúc CSDL đạt 3NF, cần bổ sung thêm giải thích chỉ mục composite.', NOW())
ON DUPLICATE KEY UPDATE `score`=VALUES(`score`);

-- 8. SEED QUIZ, QUESTIONS & OPTIONS
INSERT INTO `quizzes` (`id`, `course_id`, `title`, `description`, `duration_minutes`, `open_time`, `close_time`, `show_score_immediately`, `status`, `has_attempts`, `created_at`) VALUES
(1, 1, 'Kiểm tra giữa kỳ Trắc nghiệm', 'Đề kiểm tra trắc nghiệm 30 phút gồm các kiến thức tổng quan về Web và CSDL. Mỗi câu hỏi chỉ có 1 đáp án đúng duy nhất.', 30, '2026-11-01 08:00:00', '2026-11-30 22:00:00', TRUE, 'PUBLISHED', FALSE, NOW())
ON DUPLICATE KEY UPDATE `title`=VALUES(`title`);

-- Câu hỏi 1
INSERT INTO `questions` (`id`, `quiz_id`, `content`, `order_index`, `created_at`) VALUES
(1, 1, 'Mã trạng thái HTTP nào biểu thị quyền truy cập bị từ chối do không đủ quyền hạn (Forbidden)?', 1, NOW()),
(2, 1, 'Trong MySQL InnoDB, loại ràng buộc nào ngăn chặn việc xóa bản ghi cha khi bản ghi con đang tham chiếu tới?', 2, NOW()),
(3, 1, 'Phương thức xác thực nào sử dụng token không lưu trạng thái (stateless) phía máy chủ?', 3, NOW())
ON DUPLICATE KEY UPDATE `content`=VALUES(`content`);

-- Lựa chọn câu hỏi 1
INSERT INTO `options` (`id`, `question_id`, `content`, `is_correct`, `order_index`) VALUES
(1, 1, '401 Unauthorized', FALSE, 1),
(2, 1, '403 Forbidden', TRUE, 2),
(3, 1, '404 Not Found', FALSE, 3),
(4, 1, '500 Internal Server Error', FALSE, 4);

-- Lựa chọn câu hỏi 2
INSERT INTO `options` (`id`, `question_id`, `content`, `is_correct`, `order_index`) VALUES
(5, 2, 'CASCADE', FALSE, 1),
(6, 2, 'SET NULL', FALSE, 2),
(7, 2, 'RESTRICT / NO ACTION', TRUE, 3),
(8, 2, 'SET DEFAULT', FALSE, 4);

-- Lựa chọn câu hỏi 3
INSERT INTO `options` (`id`, `question_id`, `content`, `is_correct`, `order_index`) VALUES
(9, 3, 'Session Cookie thuần túy', FALSE, 1),
(10, 3, 'JSON Web Token (JWT)', TRUE, 2),
(11, 3, 'HTTP Basic Auth trên mỗi database lookup', FALSE, 3),
(12, 3, 'Server-side Memory Cache', FALSE, 4);

-- 9. SEED ANNOUNCEMENTS & DISCUSSIONS
INSERT INTO `announcements` (`id`, `course_id`, `author_id`, `title`, `content`, `created_at`) VALUES
(1, 1, 2, 'Chào mừng các bạn sinh viên tham gia khóa học INT3101!', 'Khóa học Lập trình Web nâng cao đã chính thức xuất bản. Các bạn hãy tải Slide Chương 1 và kiểm tra hạn nộp Bài tập lớn 1.', NOW())
ON DUPLICATE KEY UPDATE `title`=VALUES(`title`);

INSERT INTO `discussions` (`id`, `course_id`, `lesson_id`, `author_id`, `content`, `created_at`) VALUES
(1, 1, 1, 4, 'Thưa cô, cho em hỏi sự khác biệt chính giữa REST và GraphQL ở Slide trang số 12 là gì ạ?', NOW())
ON DUPLICATE KEY UPDATE `content`=VALUES(`content`);

-- 10. SEED NOTIFICATIONS
INSERT INTO `notifications` (`id`, `user_id`, `course_id`, `title`, `content`, `type`, `is_read`, `created_at`) VALUES
(1, 4, 1, 'Bài tập mới: Bài tập lớn 1: Thiết kế Database', 'Giảng viên Nguyễn Thị Mai đã giao bài tập mới với hạn nộp ngày 30/11/2026.', 'ASSIGNMENT_NEW', TRUE, NOW()),
(2, 4, 1, 'Đã có điểm bài tập: Bài tập lớn 1', 'Bài nộp của bạn đã được chấm 8.50 điểm.', 'GRADE_RELEASED', FALSE, NOW())
ON DUPLICATE KEY UPDATE `title`=VALUES(`title`);

SET foreign_key_checks = 1;

