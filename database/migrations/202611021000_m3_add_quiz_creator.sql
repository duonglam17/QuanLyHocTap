ALTER TABLE `quizzes`
    ADD COLUMN `creator_id` BIGINT NULL AFTER `course_id`;

UPDATE `quizzes` q
INNER JOIN `courses` c ON c.`id` = q.`course_id`
SET q.`creator_id` = c.`instructor_id`
WHERE q.`creator_id` IS NULL;

ALTER TABLE `quizzes`
    MODIFY COLUMN `creator_id` BIGINT NOT NULL,
    ADD INDEX `idx_quizzes_creator` (`creator_id`),
    ADD CONSTRAINT `fk_quizzes_creator`
        FOREIGN KEY (`creator_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT;
