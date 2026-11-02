# Danh mục Kiểm tra Phát hành & Nghiệm thu (Release Checklist) - LMS Mini

**Dự án:** Hệ thống Quản lý Học tập (LMS Mini) - Modular Monolith Architecture  
**Phiên bản phát hành:** v1.0.0 (Release Candidate)  
**Ngày lập danh mục:** 2026-11-02  
**Người chuẩn bị:** Developer A (Phụ trách nghiệm thu và bàn giao hệ thống)

---

## 1. Yêu cầu Hệ thống & Khởi chạy từ Máy trống (Clean Environment Setup)

### 1.1. Yêu cầu Tiền đề (Prerequisites)
- **Hệ điều hành:** Linux (Ubuntu 22.04+), macOS hoặc Windows 11 / WSL2.
- **Node.js:** Phiên bản `>= 20.10.0 LTS` (`node -v`).
- **NPM:** Phiên bản `>= 10.0.0` (`npm -v`).
- **Docker & Docker Compose:** Docker Engine `>= 24.0` và Docker Compose `>= 2.20` (`docker compose version`).

---

### 1.2. Cách 1: Khởi động Toàn bộ bằng Docker Compose (Khuyên dùng cho Nghiệm thu)

Chỉ cần một lệnh duy nhất để khởi tạo CSDL MySQL 8.0, tự động chạy migration, nạp dữ liệu mẫu và khởi động backend:

```bash
# 1. Clone mã nguồn dự án và di chuyển vào thư mục gốc
git clone https://github.com/ducanh972005/QuanLyHocTap.git
cd QuanLyHocTap

# 2. Tạo tệp cấu hình môi trường từ tệp mẫu
cp .env.example .env

# 3. Khởi chạy toàn bộ hệ thống bằng Docker Compose
docker compose up -d --build
```

**Quá trình khởi chạy tự động:**
1. Khởi động container MySQL 8.0 tại cổng `3306`, thiết lập múi giờ `+07:00` (Việt Nam) và bảng mã `utf8mb4`.
2. Áp dụng tuần tự các tệp migration từ thư mục `database/migrations/`:
   - `202611010900_m1_create_core_tables.sql` (Bảng người dùng, khóa học, bài học, lịch học)
   - `202611011000_m2_create_assignment_tables.sql` (Bảng bài tập, bài nộp, điểm số)
   - `202611011100_m3_create_quiz_interaction_tables.sql` (Bảng đề thi, câu hỏi, lượt thi, thông báo, thảo luận)
3. Tự động nạp dữ liệu mẫu từ `database/seeds/`.
4. Khởi động Backend Express tại địa chỉ: `http://localhost:5000`.

**Khởi động Frontend Client:**
```bash
cd frontend
npm ci
npm run dev
```
Giao diện Web sẵn sàng tại: `http://localhost:5173` (hoặc cổng hiển thị trong terminal).

---

### 1.3. Cách 2: Khởi động Cục bộ (Local Development / Không Docker)

Nếu máy tính đã cài sẵn MySQL cục bộ (như XAMPP hoặc MySQL Service):
```powershell
# 1. Cấu hình biến môi trường trong .env
# DB_HOST=localhost, DB_USER=root, DB_PASSWORD=..., DB_NAME=lms_mini_db

# 2. Chạy Migration và Seed CSDL
node database/migrate.js
node database/seed.js

# 3. Khởi động Backend
cd backend
npm ci
npm run start   # Chạy production tại http://localhost:5000

# 4. Mở cửa sổ terminal mới để khởi động Frontend
cd ../frontend
npm ci
npm run dev     # Chạy frontend tại http://localhost:5173
```

---

## 2. Danh sách Tài khoản Trải nghiệm & Dữ liệu Mẫu (Demo Accounts)

Tất cả tài khoản trong hệ thống sau khi chạy seed đều sử dụng mật khẩu chung: **`MatKhau@123`**

| Vai trò (Role) | Tên đăng nhập (Username) | Email | Họ và tên | Trạng thái | Ghi chú quyền hạn |
|:---|:---|:---|:---|:---:|:---|
| **ADMIN** | `admin` | `admin@lms.edu.vn` | Quản trị viên Hoàng | `ACTIVE` | Quản trị người dùng, tạo tài khoản mới, khóa/mở khóa tài khoản người dùng vi phạm. |
| **GIẢNG VIÊN** | `gv_mai` | `mai.nguyen@lms.edu.vn` | Cô Nguyễn Thị Mai | `ACTIVE` | Chủ sở hữu khóa học mẫu `INT3101`, tạo bài giảng, bài tập, đề thi, chấm điểm. |
| **GIẢNG VIÊN** | `gv_anv` | `anv.le@lms.edu.vn` | Thầy Lê Văn An | `ACTIVE` | Giảng viên khác (dùng để kiểm thử phân quyền chống IDOR). |
| **SINH VIÊN** | `sv_nam` | `nam.tran@lms.edu.vn` | Trần Văn Nam | `ACTIVE` | Đã ghi danh khóa học `INT3101`, nộp bài tập, làm bài thi, xem bảng điểm. |
| **SINH VIÊN** | `sv_hoa` | `hoa.pham@lms.edu.vn` | Phạm Thị Hoa | `ACTIVE` | Đã ghi danh khóa học `INT3101`. |
| **SINH VIÊN** | `sv_khoa` | `khoa.dang@lms.edu.vn` | Đặng Đăng Khoa | `LOCKED` | Tài khoản bị khóa (dùng để kiểm thử kịch bản chặn đăng nhập). |

### Dữ liệu Mẫu có sẵn trong CSDL:
- **Khóa học mẫu:** `INT3101` - *Lập trình Web nâng cao* (Giảng viên: `gv_mai`, Trạng thái: `PUBLISHED`).
- **Mã ghi danh (Enrollment Key):** `WEB2026` (Phân biệt hoa thường).

---

## 3. Ba Kịch bản Trình diễn Nghiệm thu (Step-by-Step Demo Scenarios)

### 3.1. Kịch bản Demo 1: Quy trình Giảng dạy - Quản lý Khóa học, Bài giảng & Lịch học (Module M1)

**Mục tiêu:** Chứng minh toàn vẹn vòng đời khóa học, đăng tải bài giảng an toàn, quản lý thời khóa biểu và sinh viên ghi danh.

1. **Bước 1 (Đăng nhập Giảng viên):**
   - Truy cập `http://localhost:5173/login`.
   - Nhập Username `gv_mai`, Password `MatKhau@123` $\rightarrow$ Nhấn **Đăng nhập**. Hệ thống điều hướng vào Danh sách khóa học.
2. **Bước 2 (Tạo khóa học mới):**
   - Nhấn **Tạo khóa học mới**, nhập Mã `CS201`, Tên `"Cấu trúc dữ liệu & Giải thuật"`, Học kỳ `"HK1-2026"`.
   - Hệ thống tự sinh mã ghi danh 6 ký tự ngẫu nhiên (ví dụ `DS2026`). Khóa học tạo thành công ở trạng thái `DRAFT`.
3. **Bước 3 (Xuất bản khóa học & Đăng bài giảng):**
   - Nhấn nút **Xuất bản khóa học** để chuyển sang `PUBLISHED` (mở cho sinh viên ghi danh).
   - Chuyển sang tab **Bài giảng** $\rightarrow$ Chọn **Thêm bài giảng mới**, nhập tiêu đề `"Chương 1: Danh sách liên kết"`.
   - Tải lên tệp tài liệu slide `PDF` (hệ thống kiểm tra magic bytes và giới hạn 50MB) $\rightarrow$ Tệp xuất hiện trong danh sách bài học.
4. **Bước 4 (Thiết lập Lịch học):**
   - Chuyển sang tab **Lịch học** $\rightarrow$ Chọn **Tạo buổi học**.
   - Chọn ngày học trong tương lai, khung giờ từ `08:00` đến `11:30`, phòng học `"A101"`. Hệ thống kiểm tra chống trùng lịch trong cùng khóa học.
5. **Bước 5 (Sinh viên Ghi danh & Học tập):**
   - Đăng xuất, đăng nhập bằng tài khoản Sinh viên `sv_nam`.
   - Chọn **Tham gia khóa học**, nhập mã ghi danh vừa tạo $\rightarrow$ Hệ thống ghi danh thành công và đưa vào không gian học tập.
   - Sinh viên tải tệp tài liệu bài giảng về máy; truy cập mục **Lịch học của tôi** để xem thời khóa biểu tuần được sắp xếp trực quan.

---

### 3.2. Kịch bản Demo 2: Quản lý Bài tập, Nộp bài, Chấm điểm & Xuất Bảng điểm (Module M2)

**Mục tiêu:** Chứng minh quy trình giao bài tập có hạn chót, nộp bài, cho phép nộp đè bài mới, chấm điểm theo bước 0.25 và xuất bảng điểm CSV có UTF-8 BOM.

1. **Bước 1 (Giảng viên giao bài tập):**
   - Giảng viên `gv_mai` vào khóa học `INT3101`, chọn tab **Bài tập**.
   - Bấm **Tạo bài tập**, nhập tiêu đề `"Bài tập lớn: Thiết kế CSDL"`, hạn nộp trong tương lai, điểm tối đa `10`.
   - Tích chọn **Cho phép nộp trễ** $\rightarrow$ Bấm **Giao bài tập**.
2. **Bước 2 (Sinh viên nộp bài & Nộp đè):**
   - Sinh viên `sv_nam` đăng nhập, vào khóa học `INT3101` $\rightarrow$ Tab **Bài tập**.
   - Bấm vào bài tập vừa giao, chọn tệp báo cáo `baocao.pdf` $\rightarrow$ Bấm **Nộp bài**. Hệ thống xác nhận `SUBMITTED`, số lần nộp là `1`.
   - Sinh viên phát hiện lỗi trong báo cáo, chọn tệp mới `baocao_v2.pdf` $\rightarrow$ Bấm **Nộp lại bài**. Hệ thống cập nhật bản nộp mới, tệp cũ được dọn dẹp, số lần nộp tăng lên `2`.
3. **Bước 3 (Giảng viên chấm bài):**
   - Giảng viên `gv_mai` vào trang chấm điểm bài tập: `/courses/1/assignments/grading`.
   - Quan sát bài nộp của `sv_nam` có số lần nộp là `2`. Giảng viên tải tệp bài làm về kiểm tra.
   - Nhập điểm `8.75` (bước nhảy 0.25 hợp lệ) và nhận xét: `"Bài làm rất tốt, phân tích chuẩn 3NF!"` $\rightarrow$ Bấm **Lưu điểm**.
4. **Bước 4 (Xem điểm cá nhân & Xuất bảng điểm lớp):**
   - Sinh viên `sv_nam` vào menu **Điểm của tôi**: Bảng điểm bài tập hiển thị rõ ràng điểm `8.75/10` kèm nhận xét của giảng viên.
   - Giảng viên `gv_mai` vào menu **Bảng điểm lớp** của khóa học: Danh sách tổng hợp điểm hiển thị phân trang 20 sinh viên.
   - Bấm nút **Xuất CSV**: Trình duyệt tải về tệp `.csv` có mã hóa UTF-8 BOM, hiển thị tiếng Việt không bị lỗi font trong Excel và các ký tự công thức được escape an toàn chống CSV Injection.

---

### 3.3. Kịch bản Demo 3: Thi Trắc nghiệm, Thảo luận Bài học & Thông báo (Module M3)

**Mục tiêu:** Chứng minh đề thi trắc nghiệm đồng bộ thời gian server, chống gian lận nhiều tab, tự động tính điểm và thảo luận chống XSS.

1. **Bước 1 (Giảng viên tạo đề thi trắc nghiệm):**
   - Giảng viên `gv_mai` vào khóa học `INT3101`, tab **Đề thi**.
   - Bấm **Tạo đề thi mới**, nhập tiêu đề `"Kiểm tra 15 phút Kiến trúc Web"`, thời lượng `15 phút`.
   - Thêm các câu hỏi trắc nghiệm (mỗi câu 4 lựa chọn, 1 đáp án đúng). Bấm **Công bố đề thi**.
2. **Bước 2 (Sinh viên làm bài & Chống gian lận 2 tab):**
   - Sinh viên `sv_nam` vào phòng thi: Hệ thống bắt đầu tính giờ bằng **đồng hồ đếm ngược đồng bộ từ máy chủ** (không dùng giờ client). Đáp án đúng hoàn toàn không bị lộ trong mã nguồn mạng/DOM.
   - Sinh viên chọn đáp án câu 1 (hệ thống tự động lưu đáp án ngầm qua API).
   - Thử nghiệm mở thêm 1 tab trình duyệt khác cùng vào đề thi: Hệ thống phát hiện xung đột phiên, cảnh báo và chỉ cho phép 1 tab hoạt động.
   - Thử nghiệm nhấn `F5` tải lại trang: Toàn bộ đáp án đã chọn và thời gian còn lại được khôi phục chính xác từ CSDL.
3. **Bước 3 (Nộp bài & Chấm điểm tức thì):**
   - Sinh viên bấm **Nộp bài**: Hệ thống tự động đóng gói trong Database Transaction, chấm điểm tự động và trả kết quả ngay lập tức (`< 200ms`).
   - Đề thi chuyển sang trạng thái đã có lượt thi: Giảng viên không còn quyền sửa hoặc xóa các câu hỏi của đề (tuân thủ BR-12, EC-07).
4. **Bước 4 (Thông báo & Diễn đàn bài học):**
   - Giảng viên đăng một thông báo mới trong khóa học: Chuông thông báo trên thanh điều hướng của sinh viên nhảy số thông báo mới tức thì.
   - Sinh viên vào bài học Chương 1, gửi bình luận thảo luận có chèn thử thẻ `<script>alert(1)</script>`: Hệ thống lọc sạch mã độc, hiển thị nội dung dạng text an toàn, ngăn chặn 100% nguy cơ Stored XSS.

---

## 4. Các Rủi ro Đã biết & Khuyến nghị Vận hành (Known Risks & Maintenance)

| STT | Rủi ro Đã biết | Mức độ ảnh hưởng | Giải pháp kiểm soát hiện tại | Khuyến nghị cho phiên bản tiếp theo |
|:---:|:---|:---:|:---|:---|
| 1 | **Biến môi trường `JWT_SECRET` mặc định:** Nếu triển khai quên đặt `JWT_SECRET` trong `.env`. | Cao | Hệ thống cảnh báo trong log; tài liệu triển khai bắt buộc tạo chuỗi bí mật ngẫu nhiên tối thiểu 32 ký tự. | Cấu hình backend dừng khởi động ngay (`process.exit(1)`) nếu phát hiện `NODE_ENV=production` mà `JWT_SECRET` là chuỗi mặc định. |
| 2 | **Khóa tài khoản tự động (BR-02):** Nhập sai 5 lần liên tiếp sẽ khóa 15 phút, kẻ xấu có thể cố tình nhập sai để khóa tài khoản người khác. | Trung bình | Đã có Rate Limiting 5 request/phút/IP để ngăn chặn tool brute-force diện rộng. | Bổ sung tính năng gửi email xác thực mở khóa tức thì hoặc Captcha sau 3 lần sai. |
| 3 | **Cảnh báo Dependency `body-parser` và `multer`:** `npm audit` báo cáo 2 lỗ hổng High liên quan đến DoS xử lý tệp/nén. | Trung bình | Không bị ảnh hưởng ở cấu hình hiện tại do ứng dụng không dùng request nén và không dùng async filter trong Multer. | Chạy nâng cấp định kỳ các thư viện phụ thuộc bằng `npm update` sau khi có đợt phát hành ổn định từ upstream Express 5. |
| 4 | **Bộ nhớ đệm khi tải tệp lớn:** Multer giữ buffer tệp trong RAM trước khi ghi xuống đĩa. | Trung bình | Đã giới hạn kích thước tối đa 50MB cho bài giảng và 20MB cho bài tập; chỉ Giảng viên mới được upload file lớn. | Chuyển sang cơ chế streaming trực tiếp từ socket mạng vào thư mục lưu trữ để giảm tải RAM khi có nhiều kết nối đồng thời. |
| 5 | **Thiếu composite index cho bảng bài nộp:** Truy vấn tổng hợp bài nộp theo khóa học có thể chậm lại khi bảng `submissions` vượt quá 50.000 dòng. | Thấp | Hiện tại với lớp học quy mô MVP dưới 1.000 sinh viên, thời gian truy vấn dưới `15ms`. | Tạo tệp migration mới `YYYYMMDDHHMM_m2_add_submission_indexes.sql` bổ sung index `(assignment_id, submitted_at)` trong Sprint bảo trì. |

---

## 5. Xác nhận & Ký duyệt Nghiệm thu (Sign-off)

- [x] Toàn bộ mã nguồn đã vượt qua kiểm tra Linting (0 errors, 0 warnings).
- [x] Đồ thị phụ thuộc kiến trúc tuân thủ nghiêm ngặt Clean Architecture.
- [x] 100% Unit Test Backend (209 tests) và Frontend (313 tests) đạt kết quả thành công.
- [x] 100% Kịch bản E2E Playwright (E2E-1, E2E-2, E2E-3) chạy ổn định và thành công.
- [x] Không còn lỗi bảo mật Critical nào tồn đọng trong mã nguồn sản phẩm.
- [x] CSDL đã sẵn sàng bộ migration và seed data hoàn chỉnh.

**KẾT LUẬN: ĐỦ ĐIỀU KIỆN ĐÓNG GÓI PHÁT HÀNH (APPROVED FOR RELEASE)**

