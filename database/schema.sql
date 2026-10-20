-- =============================================================================
-- HỆ THỐNG QUẢN LÝ HỌC TẬP (LMS MINI)
-- DATABASE SCHEMA DEFINITION (MySQL 8.0+)
-- Character Set: utf8mb4, Collation: utf8mb4_unicode_ci
-- Timezone: +07:00 (Asia/Ho_Chi_Minh)
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+07:00';
SET foreign_key_checks = 0;

-- 1. BẢNG ROLES (Vai trò người dùng)
CREATE TABLE IF NOT EXISTS `roles` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(20) NOT NULL UNIQUE,
    `description` VARCHAR(100) NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. BẢNG USERS (Tài khoản người dùng)
CREATE TABLE IF NOT EXISTS `users` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `role_id` INT NOT NULL,
    `username` VARCHAR(50) NOT NULL UNIQUE,
    `email` VARCHAR(100) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `full_name` VARCHAR(100) NOT NULL,
    `status` ENUM('ACTIVE', 'LOCKED', 'TEMPORARY_LOCKED') NOT NULL DEFAULT 'ACTIVE',
    `failed_login_attempts` INT NOT NULL DEFAULT 0,
    `lockout_until` DATETIME NULL,
    `token_version` INT NOT NULL DEFAULT 1,
    `must_change_password` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME NULL,
    CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE RESTRICT,
    INDEX `idx_users_username` (`username`),
    INDEX `idx_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. BẢNG REFRESH_TOKENS (Phiên làm việc & Token refresh)
CREATE TABLE IF NOT EXISTS `refresh_tokens` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL UNIQUE,
    `expires_at` DATETIME NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_refresh_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. BẢNG COURSES (Khóa học)
CREATE TABLE IF NOT EXISTS `courses` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `code` VARCHAR(20) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `semester` VARCHAR(20) NOT NULL,
    `instructor_id` BIGINT NOT NULL,
    `enrollment_key` VARCHAR(8) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL UNIQUE,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME NULL,
    CONSTRAINT `fk_courses_instructor` FOREIGN KEY (`instructor_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
    INDEX `idx_courses_instructor` (`instructor_id`),
    INDEX `idx_courses_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. BẢNG ENROLLMENTS (Ghi danh khóa học)
CREATE TABLE IF NOT EXISTS `enrollments` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `course_id` BIGINT NOT NULL,
    `student_id` BIGINT NOT NULL,
    `enrolled_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_enrollments_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_enrollments_student` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
    UNIQUE KEY `uk_course_student` (`course_id`, `student_id`),
    INDEX `idx_enrollments_student` (`student_id`),
    INDEX `idx_enrollments_course_student` (`course_id`, `student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. BẢNG LESSONS (Bài giảng / Chương học)
CREATE TABLE IF NOT EXISTS `lessons` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `course_id` BIGINT NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `content` TEXT NULL,
    `order_index` INT NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_lessons_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
    INDEX `idx_lessons_course_order` (`course_id`, `order_index`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. BẢNG MATERIALS (Tài liệu bài giảng)
CREATE TABLE IF NOT EXISTS `materials` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `lesson_id` BIGINT NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `original_filename` VARCHAR(255) NOT NULL,
    `file_uuid` VARCHAR(64) NOT NULL UNIQUE,
    `file_path` VARCHAR(500) NOT NULL,
    `file_size_bytes` BIGINT NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `uploaded_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_materials_lesson` FOREIGN KEY (`lesson_id`) REFERENCES `lessons` (`id`) ON DELETE CASCADE,
    INDEX `idx_materials_lesson` (`lesson_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. BẢNG SCHEDULES (Lịch học / Thời khóa biểu)
CREATE TABLE IF NOT EXISTS `schedules` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `course_id` BIGINT NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `date` DATE NOT NULL,
    `start_time` TIME NOT NULL,
    `end_time` TIME NOT NULL,
    `room_or_link` VARCHAR(255) NOT NULL,
    `status` ENUM('SCHEDULED', 'RESCHEDULED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_schedules_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
    CONSTRAINT `chk_schedule_time` CHECK (`start_time` < `end_time`),
    INDEX `idx_schedules_course_date` (`course_id`, `date`, `start_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. BẢNG ASSIGNMENTS (Bài tập tự luận)
CREATE TABLE IF NOT EXISTS `assignments` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `course_id` BIGINT NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `deadline` DATETIME NOT NULL,
    `max_score` DECIMAL(4,2) NOT NULL DEFAULT 10.00,
    `allow_late` BOOLEAN NOT NULL DEFAULT FALSE,
    `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME NULL,
    CONSTRAINT `fk_assignments_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE RESTRICT,
    INDEX `idx_assignments_course_deadline` (`course_id`, `deadline`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. BẢNG SUBMISSIONS (Bài nộp tự luận của sinh viên)
CREATE TABLE IF NOT EXISTS `submissions` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `assignment_id` BIGINT NOT NULL,
    `student_id` BIGINT NOT NULL,
    `original_filename` VARCHAR(255) NOT NULL,
    `file_uuid` VARCHAR(64) NOT NULL UNIQUE,
    `file_path` VARCHAR(500) NOT NULL,
    `file_size_bytes` BIGINT NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `submitted_at` DATETIME NOT NULL,
    `is_late` BOOLEAN NOT NULL DEFAULT FALSE,
    `late_minutes` INT NOT NULL DEFAULT 0,
    `submission_count` INT NOT NULL DEFAULT 1,
    `status` ENUM('SUBMITTED', 'SUBMITTED_LATE', 'GRADED') NOT NULL DEFAULT 'SUBMITTED',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_submissions_assignment` FOREIGN KEY (`assignment_id`) REFERENCES `assignments` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_submissions_student` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
    UNIQUE KEY `uk_assignment_student` (`assignment_id`, `student_id`),
    INDEX `idx_submissions_assignment_status` (`assignment_id`, `status`),
    INDEX `idx_submissions_student` (`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. BẢNG GRADES (Điểm số và đánh giá bài nộp tự luận)
CREATE TABLE IF NOT EXISTS `grades` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `submission_id` BIGINT NOT NULL UNIQUE,
    `graded_by` BIGINT NOT NULL,
    `score` DECIMAL(4,2) NOT NULL,
    `feedback` TEXT NULL,
    `graded_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_grades_submission` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_grades_user` FOREIGN KEY (`graded_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `chk_grade_score` CHECK (`score` >= 0.00 AND `score` <= 10.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. BẢNG QUIZZES (Đề thi trắc nghiệm)
CREATE TABLE IF NOT EXISTS `quizzes` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `course_id` BIGINT NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `duration_minutes` INT NOT NULL,
    `open_time` DATETIME NOT NULL,
    `close_time` DATETIME NOT NULL,
    `show_score_immediately` BOOLEAN NOT NULL DEFAULT TRUE,
    `status` ENUM('DRAFT', 'PUBLISHED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `has_attempts` BOOLEAN NOT NULL DEFAULT FALSE,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME NULL,
    CONSTRAINT `fk_quizzes_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `chk_quiz_time` CHECK (`open_time` < `close_time`),
    CONSTRAINT `chk_quiz_duration` CHECK (`duration_minutes` > 0),
    INDEX `idx_quizzes_course_status` (`course_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. BẢNG QUESTIONS (Câu hỏi trắc nghiệm)
CREATE TABLE IF NOT EXISTS `questions` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `quiz_id` BIGINT NOT NULL,
    `content` TEXT NOT NULL,
    `order_index` INT NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_questions_quiz` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`) ON DELETE CASCADE,
    INDEX `idx_questions_quiz` (`quiz_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. BẢNG OPTIONS (Lựa chọn trả lời cho câu hỏi)
CREATE TABLE IF NOT EXISTS `options` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `question_id` BIGINT NOT NULL,
    `content` TEXT NOT NULL,
    `is_correct` BOOLEAN NOT NULL DEFAULT FALSE,
    `order_index` INT NOT NULL DEFAULT 1,
    CONSTRAINT `fk_options_question` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON DELETE CASCADE,
    INDEX `idx_options_question` (`question_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. BẢNG ATTEMPTS (Lượt làm bài thi trắc nghiệm của sinh viên)
CREATE TABLE IF NOT EXISTS `attempts` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `quiz_id` BIGINT NOT NULL,
    `student_id` BIGINT NOT NULL,
    `session_token` VARCHAR(64) NOT NULL,
    `started_at` DATETIME NOT NULL,
    `expires_at` DATETIME NOT NULL,
    `submitted_at` DATETIME NULL,
    `total_questions` INT NOT NULL DEFAULT 0,
    `correct_answers_count` INT NOT NULL DEFAULT 0,
    `score` DECIMAL(4,2) NULL,
    `status` ENUM('IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED') NOT NULL DEFAULT 'IN_PROGRESS',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_attempts_quiz` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_attempts_student` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
    UNIQUE KEY `uk_quiz_student` (`quiz_id`, `student_id`),
    INDEX `idx_attempts_quiz_student` (`quiz_id`, `student_id`),
    INDEX `idx_attempts_status_expires` (`status`, `expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. BẢNG ATTEMPT_ANSWERS (Chi tiết câu trả lời trong lượt thi)
CREATE TABLE IF NOT EXISTS `attempt_answers` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `attempt_id` BIGINT NOT NULL,
    `question_id` BIGINT NOT NULL,
    `selected_option_id` BIGINT NULL,
    `saved_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_attempt_answers_attempt` FOREIGN KEY (`attempt_id`) REFERENCES `attempts` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_attempt_answers_question` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_attempt_answers_option` FOREIGN KEY (`selected_option_id`) REFERENCES `options` (`id`) ON DELETE RESTRICT,
    UNIQUE KEY `uk_attempt_question` (`attempt_id`, `question_id`),
    INDEX `idx_attempt_answers_attempt` (`attempt_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. BẢNG ANNOUNCEMENTS (Bảng tin thông báo trong khóa học)
CREATE TABLE IF NOT EXISTS `announcements` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `course_id` BIGINT NOT NULL,
    `author_id` BIGINT NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `content` TEXT NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_announcements_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_announcements_author` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
    INDEX `idx_announcements_course` (`course_id`, `created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. BẢNG DISCUSSIONS (Diễn đàn thảo luận bài học)
CREATE TABLE IF NOT EXISTS `discussions` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `course_id` BIGINT NOT NULL,
    `lesson_id` BIGINT NULL,
    `author_id` BIGINT NOT NULL,
    `content` TEXT NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_discussions_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_discussions_lesson` FOREIGN KEY (`lesson_id`) REFERENCES `lessons` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_discussions_author` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
    INDEX `idx_discussions_course` (`course_id`, `created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19. BẢNG NOTIFICATIONS (Hộp thư thông báo cá nhân)
CREATE TABLE IF NOT EXISTS `notifications` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT NOT NULL,
    `course_id` BIGINT NULL,
    `title` VARCHAR(200) NOT NULL,
    `content` TEXT NOT NULL,
    `type` ENUM('ASSIGNMENT_NEW', 'ANNOUNCEMENT_NEW', 'SCHEDULE_CHANGE', 'GRADE_RELEASED') NOT NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT FALSE,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_notifications_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
    INDEX `idx_notifications_user` (`user_id`, `is_read`, `created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET foreign_key_checks = 1;

