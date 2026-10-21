-- =============================================================================
-- MIGRATION: 202611020900_m2_create_assignment_due_date_and_late_flags.sql
-- Module: M2 - Bài tập tự luận & Bảng điểm (US-07: Giao bài tập)
-- Mục đích:
--   - Bổ sung cột due_date và allow_late_submission để tương thích và đồng bộ
--     với deadline và allow_late
--   - Đảm bảo tính nhất quán dữ liệu cho nghiệp vụ US-07
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+07:00';

ALTER TABLE `assignments`
    ADD COLUMN `due_date` DATETIME NULL AFTER `deadline`,
    ADD COLUMN `allow_late_submission` BOOLEAN NOT NULL DEFAULT FALSE AFTER `allow_late`;

-- Đồng bộ dữ liệu hiện có
UPDATE `assignments`
SET `due_date` = `deadline`,
    `allow_late_submission` = `allow_late`
WHERE `due_date` IS NULL;

