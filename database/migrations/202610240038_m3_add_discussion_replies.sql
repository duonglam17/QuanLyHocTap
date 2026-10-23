ALTER TABLE `discussions`
    ADD COLUMN `parent_discussion_id` BIGINT NULL AFTER `lesson_id`,
    ADD INDEX `idx_discussions_parent_created` (`parent_discussion_id`, `created_at`, `id`),
    ADD CONSTRAINT `fk_discussions_parent`
        FOREIGN KEY (`parent_discussion_id`) REFERENCES `discussions` (`id`) ON DELETE CASCADE;
