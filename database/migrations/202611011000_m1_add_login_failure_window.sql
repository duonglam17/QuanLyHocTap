ALTER TABLE `users`
    ADD COLUMN `failed_login_window_started_at` DATETIME NULL
    AFTER `failed_login_attempts`;
