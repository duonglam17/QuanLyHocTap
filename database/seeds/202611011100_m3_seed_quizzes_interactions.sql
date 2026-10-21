-- =============================================================================
-- SEED: 202611011100_m3_seed_quizzes_interactions.sql
-- Module: M3 - Đề thi trắc nghiệm, Tương tác & Thông báo
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+07:00';
SET foreign_key_checks = 0;

-- 8. SEED QUIZ, QUESTIONS & OPTIONS
INSERT INTO `quizzes` (`id`, `course_id`, `title`, `description`, `duration_minutes`, `open_time`, `close_time`, `show_score_immediately`, `status`, `has_attempts`, `created_at`) VALUES
(1, 1, 'Kiểm tra giữa kỳ Trắc nghiệm', 'Đề kiểm tra trắc nghiệm 30 phút gồm các kiến thức tổng quan về Web và CSDL. Mỗi câu hỏi chỉ có 1 đáp án đúng duy nhất.', 30, '2026-11-01 08:00:00', '2026-11-30 22:00:00', TRUE, 'PUBLISHED', FALSE, NOW())
ON DUPLICATE KEY UPDATE `title`=VALUES(`title`);

-- Câu hỏi 1, 2, 3
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

