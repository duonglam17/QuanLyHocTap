-- =============================================================================
-- SEED: 202611011000_m2_seed_assignments.sql
-- Module: M2 - Bài tập tự luận & Bảng điểm
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+07:00';
SET foreign_key_checks = 0;

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

SET foreign_key_checks = 1;

