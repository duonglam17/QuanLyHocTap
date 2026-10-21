# QUY TRÌNH VÀ HƯỚNG DẪN MIGRATION CƠ SỞ DỮ LIỆU - LMS MINI

---

## 1. Quy ước Đặt tên File Migration (BẮT BUỘC)

Mọi file migration mới trong thư mục `database/migrations/` bắt buộc phải tuân theo mẫu tên:
```
YYYYMMDDHHMM_<m1|m2|m3>_<mo-ta-ngan-gon>.sql
```

Trong đó:
- `YYYYMMDDHHMM`: Mốc thời gian năm-tháng-ngày-giờ-phút tạo file (12 chữ số). Tiền tố này quyết định thứ tự thực thi tuần tự của các migration.
- `<m1|m2|m3>`: Mã định danh module sở hữu thay đổi theo phân công 3 thành viên:
  - `m1`: Module 1 - Nền tảng, Xác thực, Khóa học, Bài giảng & Lịch học
  - `m2`: Module 2 - Bài tập tự luận & Bảng điểm
  - `m3`: Module 3 - Đề thi trắc nghiệm, Tương tác & Thông báo
- `<mo-ta-ngan-gon>`: Tên mô tả nội dung bằng tiếng Anh hoặc tiếng Việt không dấu, nối bằng dấu gạch dưới `_`.

### Ví dụ hợp lệ:
- `202611010900_m1_create_core_tables.sql`
- `202611011000_m2_create_assignment_tables.sql`
- `202611011100_m3_create_quiz_interaction_tables.sql`
- `202611051430_m2_add_feedback_column.sql`

---

## 2. Quy tắc Bất biến (IMMUTABLE MIGRATIONS)

> [!CAUTION]
> **TUYỆT ĐỐI KHÔNG SỬA FILE MIGRATION ĐÃ MERGE VÀO NHÁNH `main`!**

- Khi một file migration đã được merge hoặc chạy trên môi trường chung/đồng đội, nội dung của file đó là **bất biến**.
- Nếu cần thay đổi cấu trúc bảng, thêm cột, sửa kiểu dữ liệu hoặc đổi ràng buộc:
  1. **TẠO FILE MIGRATION MỚI** với timestamp hiện tại.
  2. Viết câu lệnh `ALTER TABLE ...`, `CREATE TABLE ...` hoặc `DROP ...` trong file mới đó.
  3. Mở Pull Request riêng và gửi cho người phụ trách duyệt.

---

## 3. Thứ tự Phụ thuộc & Khóa Ngoại giữa các Module

1. **Thứ tự thực thi:** Bảng được tham chiếu (bảng cha) **LUÔN PHẢI ĐƯỢC TẠO TRƯỚC** bảng chứa khóa ngoại (bảng con).
   - `M1` chạy đầu tiên (tạo `roles`, `users`, `courses`, `lessons`,...).
   - `M2` và `M3` chạy tiếp theo (tham chiếu khóa ngoại tới `courses.id`, `users.id`, `lessons.id` của `M1`).
2. **Vị trí định nghĩa Khóa ngoại:** Khóa ngoại liên module đặt trực tiếp bên trong file migration của bảng chứa khóa ngoại đó.
   - Ví dụ: Bảng `assignments` (thuộc M2) có FK trỏ sang `courses(id)` (thuộc M1) $\rightarrow$ Khóa ngoại được khai báo trong migration của M2 (`202611011000_m2_create_assignment_tables.sql`).

---

## 4. Cách Chạy Migration & Seed Data

### 4.1. Chạy trực tiếp bằng Node.js CLI
Từ thư mục gốc dự án:

```powershell
# Chạy toàn bộ các migration chưa áp dụng
node database/migrate.js

# Nạp dữ liệu mẫu ban đầu
node database/seed.js
```

### 4.2. Cấu hình Biến Môi trường (Environment Variables)
Nếu kết nối tới MySQL trên host hoặc Docker khác mặc định, thiết lập các biến môi trường trước khi chạy:
```powershell
$env:DB_HOST="localhost"
$env:DB_PORT="3306"
$env:DB_USER="lms_user"
$env:DB_PASSWORD="lms_password_123"
$env:DB_NAME="lms_mini_db"
node database/migrate.js
```

### 4.3. Tích hợp lệnh `npm run` (Khi thiết lập `package.json`)
Trong `package.json`, cấu hình các scripts:
```json
{
  "scripts": {
    "db:migrate": "node database/migrate.js",
    "db:seed": "node database/seed.js"
  }
}
```
Lúc này có thể chạy bằng:
```powershell
npm run db:migrate
npm run db:seed
```

---

## 5. Bảng Quản lý Trạng thái Migration (`schema_migrations`)

Công cụ `migrate.js` tự động tạo và duy trì bảng `schema_migrations` trong cơ sở dữ liệu:
```sql
CREATE TABLE `schema_migrations` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `migration_name` VARCHAR(255) NOT NULL UNIQUE,
    `applied_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```
- Khi chạy, script sẽ đối chiếu các file `.sql` trong `database/migrations/` với bảng `schema_migrations`.
- File nào đã ghi nhận sẽ được bỏ qua (`[BỎ QUA]`).
- File mới sẽ được thực thi trong một Database Transaction và ghi nhận thời điểm áp dụng thành công.

