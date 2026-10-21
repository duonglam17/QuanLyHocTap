-- =============================================================================
-- MIGRATION: 202611011000_m2_create_assignment_tables.sql
-- Module: M2 - Bài tập tự luận & Bảng điểm
-- Các bảng (3 bảng):
--   9. assignments
--   10. submissions
--   11. grades
-- Phụ thuộc khóa ngoại tới M1:
--   - assignments.course_id -> courses.id (M1)
--   - submissions.student_id -> users.id (M1)
--   - grades.graded_by -> users.id (M1)
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+07:00';
SET foreign_key_checks = 0;

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

SET foreign_key_checks = 1;

