-- =============================================================================
-- MIGRATION: 202611021910_m1_update_must_change_password_default.sql
-- Module: M1 - Core (Users & Authentication)
-- Cập nhật giá trị mặc định must_change_password về FALSE, giữ tài khoản hiện tại FALSE
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+07:00';

ALTER TABLE `users`
  MODIFY COLUMN `must_change_password` BOOLEAN NOT NULL DEFAULT FALSE;
