ALTER TABLE `notifications`
    MODIFY COLUMN `type` ENUM(
        'ASSIGNMENT_NEW',
        'ANNOUNCEMENT_NEW',
        'SCHEDULE_CHANGE',
        'GRADE_RELEASED',
        'NEW_ASSIGNMENT',
        'ASSIGNMENT_GRADED',
        'ANNOUNCEMENT',
        'SCHEDULE_CHANGED'
    ) NOT NULL,
    ADD COLUMN `ref_type` VARCHAR(50) NULL AFTER `type`,
    ADD COLUMN `ref_id` VARCHAR(255) NULL AFTER `ref_type`,
    ADD COLUMN `link` VARCHAR(2048) NULL AFTER `ref_id`;
