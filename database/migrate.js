/**
 * =============================================================================
 * LMS MINI - MIGRATION RUNNER SCRIPT (database/migrate.js)
 * =============================================================================
 * Chạy tuần tự các file migration chưa áp dụng trong database/migrations/
 * Ghi nhận lịch sử vào bảng `schema_migrations`.
 * Đảm bảo tính Idempotent: chạy lần 2 không áp dụng lại các migration đã chạy.
 * =============================================================================
 */

const fs = require('fs');
const path = require('path');

// Cấu hình kết nối từ biến môi trường (hoặc giá trị mặc định cho local dev)
const DB_CONFIG = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'lms_user',
    password: process.env.DB_PASSWORD || 'lms_password_123',
    database: process.env.DB_NAME || 'lms_mini_db',
    multipleStatements: true,
    timezone: '+07:00'
};

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function getDbConnection() {
    let mysql;
    try {
        mysql = require('mysql2/promise');
    } catch (err) {
        // Thử tìm trong backend/node_modules nếu root chưa cài
        try {
            const backendPath = path.join(__dirname, '..', 'backend', 'node_modules', 'mysql2', 'promise');
            mysql = require(backendPath);
        } catch (innerErr) {
            console.error('\n[LỖI] Không tìm thấy thư viện `mysql2`.');
            console.error('Vui lòng cài đặt bằng lệnh: npm install mysql2');
            console.error('Hoặc chạy ứng dụng bên trong Docker container (docker-compose up -d).\n');
            process.exit(1);
        }
    }

    try {
        const connection = await mysql.createConnection(DB_CONFIG);
        console.log(`[MIGRATE] Đã kết nối thành công tới MySQL [${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}]`);
        return connection;
    } catch (err) {
        console.error(`[LỖI KẾT NỐI] Không thể kết nối tới MySQL: ${err.message}`);
        console.error('Gợi ý: Kiểm tra container MySQL đang chạy: docker-compose up -d mysql');
        process.exit(1);
    }
}

async function ensureMigrationTable(connection) {
    const createTableSql = `
        CREATE TABLE IF NOT EXISTS \`schema_migrations\` (
            \`id\` INT AUTO_INCREMENT PRIMARY KEY,
            \`migration_name\` VARCHAR(255) NOT NULL UNIQUE,
            \`applied_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await connection.query(createTableSql);
}

async function getAppliedMigrations(connection) {
    const [rows] = await connection.query('SELECT `migration_name` FROM `schema_migrations`');
    return new Set(rows.map(r => r.migration_name));
}

// Danh sách migration nền tảng bắt buộc phải tạo bảng trước các migration sửa đổi
const BASELINE_MIGRATIONS = [
    '202611010900_m1_create_core_tables.sql',
    '202611011000_m1_add_login_failure_window.sql',
    '202611011000_m2_create_assignment_tables.sql',
    '202611011100_m3_create_quiz_interaction_tables.sql',
    '202611011101_m3_extend_notifications_payload.sql'
];

function sortMigrationFiles(files) {
    const baselineSet = new Set(BASELINE_MIGRATIONS);
    const baselineFiles = BASELINE_MIGRATIONS.filter(f => files.includes(f));
    const nonBaselineFiles = files.filter(f => !baselineSet.has(f)).sort();
    return [...baselineFiles, ...nonBaselineFiles];
}

async function runMigrations() {
    console.log('===========================================================');
    console.log('   BẮT ĐẦU CHẠY DATABASE MIGRATIONS - LMS MINI');
    console.log('===========================================================');

    if (!fs.existsSync(MIGRATIONS_DIR)) {
        console.error(`[LỖI] Thư mục ${MIGRATIONS_DIR} không tồn tại.`);
        process.exit(1);
    }

    const allFiles = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql'));
    const files = sortMigrationFiles(allFiles);

    if (files.length === 0) {
        console.log('[MIGRATE] Không có file migration nào trong database/migrations/.');
        return;
    }

    const connection = await getDbConnection();

    try {
        await ensureMigrationTable(connection);
        const applied = await getAppliedMigrations(connection);

        let countApplied = 0;

        for (const file of files) {
            if (applied.has(file)) {
                console.log(`[BỎ QUA] Đã áp dụng trước đó: ${file}`);
                continue;
            }

            console.log(`[ÁP DỤNG] Đang chạy migration: ${file}...`);
            const filePath = path.join(MIGRATIONS_DIR, file);
            const sqlContent = fs.readFileSync(filePath, 'utf8');

            // Thực thi nội dung file SQL trong transaction
            await connection.beginTransaction();
            try {
                await connection.query(sqlContent);
                await connection.query(
                    'INSERT INTO `schema_migrations` (`migration_name`, `applied_at`) VALUES (?, NOW())',
                    [file]
                );
                await connection.commit();
                console.log(`[THÀNH CÔNG] Hoàn tất: ${file}`);
                countApplied++;
            } catch (sqlErr) {
                await connection.rollback();
                console.error(`\n[LỖI THỰC THI] Migration thất bại tại file: ${file}`);
                console.error(`Chi tiết lỗi: ${sqlErr.message}`);
                console.error('Đã tự động ROLLBACK toàn bộ thay đổi của file này.');
                process.exit(1);
            }
        }

        console.log('===========================================================');
        if (countApplied === 0) {
            console.log('[MIGRATE] Cơ sở dữ liệu đã ở trạng thái mới nhất. Không có migration nào mới.');
        } else {
            console.log(`[MIGRATE] Hoàn tất thành công! Đã áp dụng ${countApplied} migration mới.`);
        }
        console.log('===========================================================');
    } finally {
        await connection.end();
    }
}

// Chạy trực tiếp nếu gọi từ dòng lệnh
if (require.main === module) {
    runMigrations().catch(err => {
        console.error('[MIGRATE LỖI KHÔNG XÁC ĐỊNH]', err);
        process.exit(1);
    });
}

module.exports = { runMigrations, sortMigrationFiles };

