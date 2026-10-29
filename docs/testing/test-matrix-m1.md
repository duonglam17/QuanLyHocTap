# Ma trận Truy vết Kiểm thử Module M1 (Traceability Test Matrix)
*Dự án LMS Mini - Module M1: Nền tảng, Tài khoản, Khóa học, Bài giảng & Lịch học*
*Tài liệu sinh theo vai trò QA Automation Engineer (`qa-automation-engineer`)*

---

## 1. Tổng quan Ma trận Truy vết M1

- **Phạm vi User Story:** US-01, US-02, US-03, US-04, US-05, US-06, US-17, US-18.
- **Quy tắc nghiệp vụ (BR) liên quan:** BR-01, BR-02, BR-03, BR-04, BR-05, BR-06, BR-09, BR-10, BR-11, BR-19, BR-20.
- **Tình huống biên & Rủi ro (EC) liên quan:** EC-01, EC-03, EC-08, EC-09, EC-14, EC-15, EC-18, EC-19, EC-20, EC-22, EC-23, EC-24.
- **Tổng số Scenarios Gherkin:** **23 Scenarios**.

### Thống kê Trạng thái Kiểm thử (Cập nhật sau Bước T3):
- **Test Unit Service & Controller (Mock/Fake Repo):** Đã bao phủ **23/23 Scenarios** (49 unit tests pass).
- **Test Tích hợp API Backend (Integration Suite):** Đã bổ sung `backend/tests/m1/m1.integration.test.js` (3 test suites lớn kiểm tra toàn diện 3 cấp độ phân quyền: đúng vai trò, sai vai trò, người ngoài khóa / IDOR; các mã lỗi 400, 401, 403, 404, 409, 422, 429; và đồng hồ giả lập `clock.now()` với lockout 15 phút).
- **Test Tích hợp CSDL thật (MySQL Integration Suite):** Đã bổ sung `backend/tests/m1/m1.db.test.js` kiểm tra ràng buộc duy nhất (username, email, enrollmentKey, active enrollment), transaction và câu truy vấn khóa dòng `SELECT ... FOR UPDATE` trên CSDL MySQL thật.
- **Test Frontend Component & Page (Mock API):** Đã bao phủ toàn diện **23/23 Scenarios** với **82 frontend tests pass** (tăng từ 61 lên 82 tests), kiểm tra:
  - **3 trạng thái mạng:** Đang tải (Loading Skeleton), Lỗi (Error có nút Thử lại - Retry), Thành công kèm trạng thái Rỗng (Empty state cho từng vai trò).
  - **Khóa nút khi đang gửi:** Vô hiệu hóa submit button (`disabled={submitting}`) và input fields khi đang gửi request (`CourseFormDialog`, `EnrollmentDialog`, `UserFormDialog`, `ChangeRoleDialog`, `LessonFormDialog`, `MaterialUploadDialog`, `ScheduleFormDialog`).
  - **Xử lý toàn diện mã lỗi HTTP:** 401, 403 (kể cả IDOR), 404, 409 (xung đột dữ liệu / khóa học lưu trữ), 413 (tệp vượt 50MB), 415 (định dạng không hỗ trợ), 422 (dữ liệu không hợp lệ), 429 (vượt tần suất yêu cầu).
  - **Xử lý trường null:** Điểm thi/đánh giá null hiển thị `"Chưa có"` (`formatScore(null) === 'Chưa có'`), ngày null (`formatDateTime(null) === 'Chưa có'`), mô tả/nội dung/phòng học null hiển thị đúng thiết kế mà không gây lỗi giao diện.
- **Test E2E Luồng Giảng dạy (Playwright E2E-1):** **Thiếu** trên các Scenarios thuộc hành trình giảng dạy US-03, US-04, US-05, US-06, US-17, US-18 (tệp `e2e/specs/e1-giang-day.spec.js` sẽ triển khai tại bước T5).

---

## 2. Bảng Ma trận Truy vết Chi tiết (Scenario-level Traceability Matrix)

| US | Scenario Gherkin | BR / EC | Test hiện có (Tệp test, Tên test) | Trạng thái | Loại test cần |
|---|---|---|---|---|---|
| **US-01** | `Dang nhap thanh cong voi thong tin chinh xac` | BR-01 | **BE:** `auth.test.js`, `m1.integration.test.js`<br>**FE:** `LoginPage.test.jsx` | **Đã có** (Unit, Integration, FE) / **Thiếu** (E2E) | Unit, Integration, Frontend, E2E |
| **US-01** | `Dang nhap that bai do sai thong tin` (Outline: sai pass, user không tồn tại, để trống username, để trống pass) | BR-01, EC-08 | **BE:** `auth.test.js`, `m1.integration.test.js`<br>**FE:** `LoginPage.test.jsx` | **Đã có** (Unit, Integration, FE) | Unit, Integration, Frontend |
| **US-01** | `Khoa tam thoi tai khoan khi nhap sai qua 5 lan lien tiep (Chong Brute Force)` | BR-02, EC-08 | **BE:** `auth.test.js` (lockout 15m), `m1.integration.test.js` (clock advance 16m mở khóa)<br>**FE:** `LoginPage.test.jsx` (403 TEMPORARY_LOCKED, 429) | **Đã có** (Unit, Integration, FE) | Unit, Integration, Frontend |
| **US-01** | `Dang nhap bang tai khoan dang bi khoa` | BR-01, EC-01, EC-08 | **BE:** `auth.test.js`, `m1.integration.test.js`<br>**FE:** `LoginPage.test.jsx` (403 LOCKED) | **Đã có** (Unit, Integration, FE) | Unit, Integration, Frontend |
| **US-02** | `Admin tao moi tai khoan giang vien thanh cong` | BR-01 | **BE:** `users.test.js`, `m1.integration.test.js`, `m1.db.test.js`<br>**FE:** `AdminUsersPage.test.jsx` | **Đã có** (Unit, Integration, FE) | Unit, Integration, Frontend |
| **US-02** | `Admin tao tai khoan trung ten dang nhap hoac email da ton tai` | BR-01 | **BE:** `users.test.js` (409), `m1.integration.test.js` (409), `m1.db.test.js` (ER_DUP_ENTRY)<br>**FE:** `AdminUsersPage.test.jsx` | **Đã có** (Unit, Integration, FE) | Unit, Integration, Frontend |
| **US-02** | `Admin khoa tai khoan nguoi dung dang vi pham` | BR-01, BR-02 | **BE:** `users.test.js`, `m1.integration.test.js` (chặn self-lock 403, lock/unlock 200)<br>**FE:** `AdminUsersPage.test.jsx` | **Đã có** (Unit, Integration, FE) | Unit, Integration, Frontend |
| **US-03** | `Tao khoa hoc moi thanh cong` | BR-03, BR-04 | **BE:** `course.test.js`, `m1.integration.test.js`, `m1.db.test.js`<br>**FE:** `CoursesPage.test.jsx` | **Đã có** (Unit, Integration, FE) / **Thiếu** (E2E) | Unit, Integration, Frontend, E2E |
| **US-03** | `Tao khoa hoc that bai do thieu thong tin bat buoc` | BR-03 | **BE:** `course.test.js` (422), `m1.integration.test.js`<br>**FE:** `CoursesPage.test.jsx` | **Đã có** (Unit, Integration, FE) | Unit, Integration, Frontend |
| **US-03** | `Giang vien xuat ban (Publish) khoa hoc de mo ghi danh` | BR-04, EC-09 | **BE:** `course.test.js`, `m1.integration.test.js` (owner 200 vs stranger 403 IDOR)<br>**FE:** `CourseDetailPage.test.jsx` | **Đã có** (Unit, Integration, FE) / **Thiếu** (E2E) | Unit, Integration, Frontend, E2E |
| **US-04** | `Ghi danh thanh cong voi ma chinh xac` | BR-04, BR-05, EC-15 | **BE:** `course.test.js`, `m1.integration.test.js`, `m1.db.test.js`<br>**FE:** `CoursesPage.test.jsx` | **Đã có** (Unit, Integration, FE) / **Thiếu** (E2E) | Unit, Integration, Frontend, E2E |
| **US-04** | `Ghi danh that bai do ma khong hop le hoac sai ma` (Outline: sai mã, mã rỗng, EC-22 Rate Limiting) | BR-04, EC-22 | **BE:** `course.test.js` (400, 429), `m1.integration.test.js`<br>**FE:** `CoursesPage.test.jsx` | **Đã có** (Unit, Integration, FE) | Unit, Integration, Frontend |
| **US-04** | `Sinh vien co tinh ghi danh lai vao khoa hoc da tham gia` | BR-05 | **BE:** `course.test.js` (409), `m1.integration.test.js` (409), `m1.db.test.js` (ER_DUP_ENTRY)<br>**FE:** `CoursesPage.test.jsx` | **Đã có** (Unit, Integration, FE) | Unit, Integration, Frontend |
| **US-05** | `Dang tai tai lieu hop le thanh cong` | BR-06, BR-10, EC-19 | **BE:** `lessons.test.js`, `m1.integration.test.js`<br>**FE:** `LessonTab.test.jsx`, `LessonDetailPage.test.jsx` | **Đã có** (Unit, Integration, FE) / **Thiếu** (E2E) | Unit, Integration, Frontend, E2E |
| **US-05** | `Tu choi dang tai tep vuot qua dung luong cho phep` | BR-06, EC-03 | **BE:** `lessons.test.js` (50MB limit), `common.test.js`<br>**FE:** `LessonTab.test.jsx` | **Đã có** (Unit, Integration, FE) | Unit, Integration, Frontend |
| **US-05** | `Ngan chan upload tep tin chua ma doc hoac duoi thuc thi` | BR-06, BR-10, EC-03 | **BE:** `lessons.test.js`, `common.test.js` (magic bytes & extension)<br>**FE:** `LessonTab.test.jsx` | **Đã có** (Unit, Integration, FE) | Unit, Integration, Frontend |
| **US-06** | `Sinh vien da tham gia khoa hoc tai tai lieu thanh cong` | BR-05, BR-11, EC-18 | **BE:** `lessons.test.js`, `m1.integration.test.js` (enrolled 200)<br>**FE:** `LessonTab.test.jsx`, `LessonDetailPage.test.jsx` | **Đã có** (Unit, Integration, FE) / **Thiếu** (E2E) | Unit, Integration, Frontend, E2E |
| **US-06** | `Sinh vien chua ghi danh co tinh tai tai lieu qua URL truc tiep (Chong IDOR)` | BR-05, BR-11, EC-01 | **BE:** `lessons.test.js` (403), `m1.integration.test.js` (stranger 403 IDOR, unauth 401)<br>**FE:** `LessonDetailPage.test.jsx` (403/404 lỗi tải tệp) | **Đã có** (Unit, Integration, FE) | Unit, Integration, Frontend |
| **US-17** | `Tao buoi hoc moi thanh cong` | BR-03, BR-19 | **BE:** `schedule.test.js`, `m1.integration.test.js`, `m1.db.test.js`<br>**FE:** `ScheduleTab.test.jsx` | **Đã có** (Unit, Integration, FE) / **Thiếu** (E2E) | Unit, Integration, Frontend, E2E |
| **US-17** | `Tao buoi hoc that bai do thoi gian khong hop le` (Outline: end <= start, thiếu giờ) | BR-19 | **BE:** `schedule.test.js` (400/422), `m1.integration.test.js` (400/422)<br>**FE:** `ScheduleTab.test.jsx` | **Đã có** (Unit, Integration, FE) | Unit, Integration, Frontend |
| **US-17** | `Canh bao khi tao buoi hoc trung gio voi buoi hoc da co trong cung khoa hoc` | BR-19, EC-23, EC-24 | **BE:** `schedule.test.js` (409 `SCHEDULE_CONFLICT`), `m1.integration.test.js` (409), `m1.db.test.js` (FOR UPDATE)<br>**FE:** `ScheduleTab.test.jsx` | **Đã có** (Unit, Integration, FE) | Unit, Integration, Frontend |
| **US-18** | `Sinh vien xem lich hoc cua khoa hoc thanh cong` | BR-05, BR-20, EC-24 | **BE:** `schedule.test.js`, `m1.integration.test.js` (enrolled 200)<br>**FE:** `ScheduleTab.test.jsx`, `MySchedulePage.test.jsx` | **Đã có** (Unit, Integration, FE) / **Thiếu** (E2E) | Unit, Integration, Frontend, E2E |
| **US-18** | `Sinh vien chua ghi danh co tinh xem lich hoc chi tiet (Chong IDOR)` | BR-05, BR-20, EC-01 | **BE:** `schedule.test.js` (403), `m1.integration.test.js` (stranger 403 IDOR)<br>**FE:** `MySchedulePage.test.jsx` (401/403 lỗi tải thời khóa biểu) | **Đã có** (Unit, Integration, FE) | Unit, Integration, Frontend |

---

## 3. Tổng kết Phân tích & Hạng mục Thiếu

### 3.1. Số liệu Thống kê:
- **Tổng số Scenarios Gherkin:** **23 mục**.
- **Số mục đã hoàn tất Unit Test & Integration Test Backend:** **23/23 mục** (100% bao phủ đầy đủ phân quyền 3 loại, IDOR, ràng buộc dữ liệu, các mã lỗi 400/401/403/404/409/422/429, đồng hồ giả lập và MySQL).
- **Số mục đã hoàn tất Frontend Test:** **23/23 mục** (82/82 tests pass).
- **Số mục Thiếu E2E Test (Playwright):** **6 User Stories** cốt lõi của hành trình Giảng dạy (US-03, US-04, US-05, US-06, US-17, US-18) chưa có tệp `e2e/specs/e1-giang-day.spec.js` (sẽ triển khai tại bước T5).

### 3.2. Hướng dẫn Chạy Kiểm thử CSDL MySQL Thật:
Để chạy kiểm thử `m1.db.test.js` trên CSDL MySQL thật:
1. Khởi động MySQL service (hoặc XAMPP MySQL).
2. Tạo CSDL kiểm thử hoặc đặt biến môi trường:
   ```powershell
   $env:DB_NAME = "lms_mini_db"
   # hoặc $env:M1_TEST_DB_NAME = "lms_m1_test"
   node --test backend/tests/m1/m1.db.test.js
   ```
