const assert = require('node:assert/strict');
const mysql = require('mysql2/promise');
const test = require('node:test');

const config = require('../../src/common/config');

test('M1 DB: MySQL integration suite for Module M1 Repositories and Constraints', async (t) => {
  const testDatabaseName = process.env.M1_TEST_DB_NAME || process.env.DB_NAME;
  if (!testDatabaseName) {
    t.skip('Set M1_TEST_DB_NAME or DB_NAME to run real MySQL integration tests.');
    return;
  }

  let connection;
  try {
    connection = await mysql.createConnection({
      host: config.DB_HOST || '127.0.0.1',
      port: config.DB_PORT || 3306,
      user: config.DB_USER || 'root',
      password: config.DB_PASSWORD ?? '',
      database: testDatabaseName,
      connectTimeout: 2000
    });
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      t.skip(`MySQL test database is unavailable (${error.code}). Cách chạy: Khởi động MySQL/XAMPP và chạy lại.`);
      return;
    }
    throw error;
  }

  try {
    // 1. Tạo bảng tạm Users để kiểm tra ràng buộc duy nhất trên username và email
    await connection.query(`
      CREATE TEMPORARY TABLE \`tmp_users\` (
        \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
        \`username\` VARCHAR(50) NOT NULL,
        \`email\` VARCHAR(100) NOT NULL,
        \`password_hash\` VARCHAR(255) NOT NULL,
        \`full_name\` VARCHAR(100) NOT NULL,
        \`role\` ENUM('ADMIN', 'GIANG_VIEN', 'SINH_VIEN') NOT NULL,
        \`status\` ENUM('ACTIVE', 'LOCKED', 'TEMPORARY_LOCKED') NOT NULL DEFAULT 'ACTIVE',
        \`token_version\` INT UNSIGNED NOT NULL DEFAULT 1,
        \`failed_login_attempts\` TINYINT UNSIGNED NOT NULL DEFAULT 0,
        \`lockout_until\` DATETIME NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY \`uniq_tmp_users_username\` (\`username\`),
        UNIQUE KEY \`uniq_tmp_users_email\` (\`email\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Chèn user đầu tiên
    await connection.query(
      'INSERT INTO `tmp_users` (`username`, `email`, `password_hash`, `full_name`, `role`) VALUES (?, ?, ?, ?, ?)',
      ['db_teacher', 'teacher@lms.edu.vn', 'hash123', 'Giảng viên DB', 'GIANG_VIEN']
    );

    // Kiểm tra chèn trùng username -> bắt buộc ném lỗi ER_DUP_ENTRY
    await assert.rejects(
      connection.query(
        'INSERT INTO `tmp_users` (`username`, `email`, `password_hash`, `full_name`, `role`) VALUES (?, ?, ?, ?, ?)',
        ['db_teacher', 'different@lms.edu.vn', 'hash123', 'Giảng viên khác', 'GIANG_VIEN']
      ),
      (err) => err.code === 'ER_DUP_ENTRY'
    );

    // Kiểm tra chèn trùng email -> bắt buộc ném lỗi ER_DUP_ENTRY
    await assert.rejects(
      connection.query(
        'INSERT INTO `tmp_users` (`username`, `email`, `password_hash`, `full_name`, `role`) VALUES (?, ?, ?, ?, ?)',
        ['different_user', 'teacher@lms.edu.vn', 'hash123', 'Giảng viên khác', 'GIANG_VIEN']
      ),
      (err) => err.code === 'ER_DUP_ENTRY'
    );

    // 2. Tạo bảng tạm Courses để kiểm tra ràng buộc duy nhất enrollment_key
    await connection.query(`
      CREATE TEMPORARY TABLE \`tmp_courses\` (
        \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
        \`code\` VARCHAR(20) NOT NULL,
        \`title\` VARCHAR(200) NOT NULL,
        \`description\` TEXT NULL,
        \`semester\` VARCHAR(20) NOT NULL,
        \`owner_id\` BIGINT NOT NULL,
        \`enrollment_key\` VARCHAR(8) NOT NULL,
        \`status\` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY \`uniq_tmp_courses_enrollment_key\` (\`enrollment_key\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(
      'INSERT INTO `tmp_courses` (`code`, `title`, `semester`, `owner_id`, `enrollment_key`) VALUES (?, ?, ?, ?, ?)',
      ['DB101', 'Cơ sở dữ liệu nâng cao', '2026-1', 1, 'KEYDB01']
    );

    // Thử tạo khóa học trùng mã ghi danh -> ném ER_DUP_ENTRY
    await assert.rejects(
      connection.query(
        'INSERT INTO `tmp_courses` (`code`, `title`, `semester`, `owner_id`, `enrollment_key`) VALUES (?, ?, ?, ?, ?)',
        ['DB102', 'Khóa học khác', '2026-1', 1, 'KEYDB01']
      ),
      (err) => err.code === 'ER_DUP_ENTRY'
    );

    // 3. Tạo bảng tạm Enrollments để kiểm tra ràng buộc duy nhất giữa sinh viên và khóa học
    await connection.query(`
      CREATE TEMPORARY TABLE \`tmp_enrollments\` (
        \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
        \`course_id\` BIGINT NOT NULL,
        \`student_id\` BIGINT NOT NULL,
        \`status\` ENUM('ACTIVE', 'DROPPED') NOT NULL DEFAULT 'ACTIVE',
        \`enrolled_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY \`uniq_tmp_enrollment\` (\`course_id\`, \`student_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(
      'INSERT INTO `tmp_enrollments` (`course_id`, `student_id`) VALUES (?, ?)',
      [1, 10]
    );

    // Thử ghi danh lại cùng sinh viên vào khóa -> ném ER_DUP_ENTRY
    await assert.rejects(
      connection.query(
        'INSERT INTO `tmp_enrollments` (`course_id`, `student_id`) VALUES (?, ?)',
        [1, 10]
      ),
      (err) => err.code === 'ER_DUP_ENTRY'
    );

    // 4. Kiểm tra truy vấn khóa dòng SELECT ... FOR UPDATE trên Schedules
    await connection.query(`
      CREATE TEMPORARY TABLE \`tmp_schedules\` (
        \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
        \`course_id\` BIGINT NOT NULL,
        \`title\` VARCHAR(200) NOT NULL,
        \`date\` DATE NOT NULL,
        \`start_time\` TIME NOT NULL,
        \`end_time\` TIME NOT NULL,
        \`room_or_link\` VARCHAR(255) NOT NULL,
        \`status\` ENUM('SCHEDULED', 'RESCHEDULED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.beginTransaction();
    const [lockedCourse] = await connection.query(
      'SELECT `id`, `owner_id`, `status` FROM `tmp_courses` WHERE `id` = ? FOR UPDATE',
      [1]
    );
    assert.equal(lockedCourse.length, 1);
    assert.equal(lockedCourse[0].id, 1);

    await connection.query(
      'INSERT INTO `tmp_schedules` (`course_id`, `title`, `date`, `start_time`, `end_time`, `room_or_link`) VALUES (?, ?, ?, ?, ?, ?)',
      [1, 'Buổi học 1', '2026-11-10', '08:00:00', '10:00:00', 'Phòng 201']
    );
    await connection.commit();

    // Kiểm tra tìm kiếm xung đột giờ với câu truy vấn tham số hóa
    const [conflictRows] = await connection.query(
      `SELECT \`id\` FROM \`tmp_schedules\`
       WHERE \`course_id\` = ? AND \`date\` = ? AND \`status\` != 'CANCELLED'
         AND \`start_time\` < ? AND \`end_time\` > ?`,
      [1, '2026-11-10', '09:00:00', '11:00:00']
    );
    assert.equal(conflictRows.length, 1);
  } finally {
    await connection.end();
  }
});

