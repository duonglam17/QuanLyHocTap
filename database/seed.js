/**
 * =============================================================================
 * LMS MINI - SEED RUNNER SCRIPT (database/seed.js)
 * =============================================================================
 * Nạp dữ liệu mẫu ban đầu từ thư mục database/seeds/ theo đúng thứ tự module.
 * =============================================================================
 */

const fs = require('fs');
const path = require('path');

const DB_CONFIG = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'lms_user',
    password: process.env.DB_PASSWORD || 'lms_password_123',
    database: process.env.DB_NAME || 'lms_mini_db',
    multipleStatements: true,
    timezone: '+07:00'
};

const SEEDS_DIR = path.join(__dirname, 'seeds');

async function getDbConnection() {
    let mysql;
    try {
        mysql = require('mysql2/promise');
    } catch (err) {
        try {
            const backendPath = path.join(__dirname, '..', 'backend', 'node_modules', 'mysql2', 'promise');
            mysql = require(backendPath);
        } catch (innerErr) {
            console.error('\n[LỖI] Không tìm thấy thư viện `mysql2`. Vui lòng cài đặt: npm install mysql2\n');
            process.exit(1);
        }
    }

    try {
        const connection = await mysql.createConnection(DB_CONFIG);
        console.log(`[SEED] Đã kết nối thành công tới MySQL [${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}]`);
        return connection;
    } catch (err) {
        console.error(`[LỖI KẾT NỐI] Không thể kết nối tới MySQL: ${err.message}`);
        process.exit(1);
    }
}

async function runSeeds() {
    console.log('===========================================================');
    console.log('   BẮT ĐẦU NẠP DỮ LIỆU MẪU (DATABASE SEEDS) - LMS MINI');
    console.log('===========================================================');

    if (!fs.existsSync(SEEDS_DIR)) {
        console.error(`[LỖI] Thư mục ${SEEDS_DIR} không tồn tại.`);
        process.exit(1);
    }

    const files = fs.readdirSync(SEEDS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort(); // Sắp xếp theo tên (thứ tự timestamp YYYYMMDDHHMM)

    if (files.length === 0) {
        console.log('[SEED] Không có file seed nào trong database/seeds/.');
        return;
    }

    const connection = await getDbConnection();

    try {
        for (const file of files) {
            console.log(`[SEEDING] Đang nạp seed: ${file}...`);
            const filePath = path.join(SEEDS_DIR, file);
            const sqlContent = fs.readFileSync(filePath, 'utf8');

            await connection.query(sqlContent);
            console.log(`[THÀNH CÔNG] Đã nạp xong: ${file}`);
        }

        console.log('===========================================================');
        console.log(`[SEED] Hoàn tất nạp thành công toàn bộ ${files.length} file dữ liệu mẫu!`);
        console.log('===========================================================');
    } catch (err) {
        console.error(`\n[LỖI THỰC THI SEED] ${err.message}`);
        process.exit(1);
    } finally {
        await connection.end();
    }
}

if (require.main === module) {
    runSeeds().catch(err => {
        console.error('[SEED LỖI KHÔNG XÁC ĐỊNH]', err);
        process.exit(1);
    });
}

module.exports = { runSeeds };

