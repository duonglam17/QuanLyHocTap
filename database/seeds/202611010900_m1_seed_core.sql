-- =============================================================================
-- SEED: 202611010900_m1_seed_core.sql
-- Module: M1 - Nền tảng, Người dùng, Khóa học, Bài giảng & Lịch học
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
-- Mật khẩu mặc định: MatKhau@123
INSERT INTO `users` (`id`, `role_id`, `username`, `email`, `password_hash`, `full_name`, `status`, `token_version`, `must_change_password`, `created_at`) VALUES
(1, 1, 'admin', 'admin@lms.edu.vn', '$2b$10$7bRhTeuijGxQONQ/XCyWT.aKURFSUyEdELUHFx.Zf/SNYysVqvrrS', 'Quản trị viên Hoàng', 'ACTIVE', 1, FALSE, NOW()),
(2, 2, 'gv_mai', 'mai.nguyen@lms.edu.vn', '$2b$10$7bRhTeuijGxQONQ/XCyWT.aKURFSUyEdELUHFx.Zf/SNYysVqvrrS', 'Cô Nguyễn Thị Mai', 'ACTIVE', 1, FALSE, NOW()),
(3, 2, 'gv_anv', 'anv.le@lms.edu.vn', '$2b$10$7bRhTeuijGxQONQ/XCyWT.aKURFSUyEdELUHFx.Zf/SNYysVqvrrS', 'Thầy Lê Văn An', 'ACTIVE', 1, FALSE, NOW()),
(4, 3, 'sv_nam', 'nam.tran@lms.edu.vn', '$2b$10$7bRhTeuijGxQONQ/XCyWT.aKURFSUyEdELUHFx.Zf/SNYysVqvrrS', 'Trần Văn Nam', 'ACTIVE', 1, FALSE, NOW()),
(5, 3, 'sv_hoa', 'hoa.pham@lms.edu.vn', '$2b$10$7bRhTeuijGxQONQ/XCyWT.aKURFSUyEdELUHFx.Zf/SNYysVqvrrS', 'Phạm Thị Hoa', 'ACTIVE', 1, FALSE, NOW()),
(6, 3, 'sv_khoa', 'khoa.dang@lms.edu.vn', '$2b$10$7bRhTeuijGxQONQ/XCyWT.aKURFSUyEdELUHFx.Zf/SNYysVqvrrS', 'Đặng Đăng Khoa', 'LOCKED', 1, FALSE, NOW())
ON DUPLICATE KEY UPDATE `username`=VALUES(`username`), `password_hash`=VALUES(`password_hash`);

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

SET foreign_key_checks = 1;

