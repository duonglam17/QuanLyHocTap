ALTER TABLE `attempts`
    ADD COLUMN `client_instance_id` VARCHAR(128) NULL AFTER `student_id`,
    ADD COLUMN `takeover_count` TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER `session_token`,
    ADD COLUMN `last_takeover_at` DATETIME NULL AFTER `takeover_count`;

UPDATE `attempts`
SET `client_instance_id` = CONCAT('legacy-', `id`)
WHERE `client_instance_id` IS NULL;

ALTER TABLE `attempts`
    MODIFY COLUMN `client_instance_id` VARCHAR(128) NOT NULL,
    ADD CONSTRAINT `chk_attempts_takeover_count` CHECK (`takeover_count` <= 5);
