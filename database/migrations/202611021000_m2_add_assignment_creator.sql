ALTER TABLE `assignments`
    ADD COLUMN `created_by` BIGINT NULL AFTER `course_id`,
    ADD INDEX `idx_assignments_created_by` (`created_by`),
    ADD CONSTRAINT `fk_assignments_creator`
        FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT;

UPDATE `assignments` a
INNER JOIN `courses` c ON c.`id` = a.`course_id`
SET a.`created_by` = c.`instructor_id`
WHERE a.`created_by` IS NULL;
