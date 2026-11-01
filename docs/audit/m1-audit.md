# Báo cáo kiểm tra bảo mật và hiệu năng Module M1

- **Ngày kiểm tra:** 2026-11-02
- **Nhánh:** `feat/m3-kiem-tra-bao-mat`
- **Phạm vi:** `backend/src/modules/m1-core/`, `frontend/src/modules/m1/`,
  `docs/openapi/m1.yaml`, migration M1, phần `common`/`shared` M1 sử dụng và
  Port `courseAccess`.
- **Phương pháp:** rà soát route, quyền, xác thực, dữ liệu đầu vào, upload,
  SQL, phân trang, hợp đồng OpenAPI và Port; `npm audit` và `EXPLAIN` trên
  database E2E cô lập. Chỉ đọc M1 và không chạy `npm audit fix`.

## 1. Bảng phát hiện

| ID | Loại | Mức độ | Vị trí | Phát hiện |
|---|---|---|---|---|
| M1-SEC-01 | Cấu hình xác thực / JWT | Cao | `backend/src/common/config.js:8-20,36-37`; `backend/src/common/authMiddleware.js:21-45` | `NODE_ENV` mặc định là `development`, và trong chế độ đó JWT secret có giá trị mặc định đã biết. Kiểm tra bắt buộc secret riêng chỉ chạy khi `NODE_ENV` được đặt tường minh là `production`. Nếu triển khai quên đặt `NODE_ENV`, ứng dụng vẫn chạy với khóa ký mặc định; kẻ biết khóa và một ID/token_version hợp lệ có thể giả mạo JWT vai trò cao. |
| M1-SEC-02 | Từ chối dịch vụ tài khoản | Trung bình | `backend/src/modules/m1-core/repositories/authRepository.js:63-89`; `backend/src/modules/m1-core/services/authService.js:102-108`; `backend/src/modules/m1-core/routes/authRoutes.js:10-20` | Năm lần đăng nhập sai cho một tài khoản trong cửa sổ 10 phút sẽ khóa tài khoản 15 phút. Giới hạn đăng nhập mặc định cho phép đúng 5 request/phút/IP, nên người biết tên đăng nhập có thể chủ động làm tài khoản hợp lệ không đăng nhập được. Đây là rủi ro của chính sách khóa hiện hành, không phải bỏ qua giới hạn đăng nhập. |
| M1-DEP-01 | Dependency / xử lý request | Cao | `backend/src/app.js:184-186`; dependency `body-parser@1.20.8` | `npm audit` báo GHSA-27r3-jxmh-p828: DoS khi xử lý compressed request có trailing bytes. Express JSON parser dùng chung nằm trước các route M1, vì vậy endpoint JSON M1 nằm trên đường xử lý bị ảnh hưởng. |
| M1-DEP-02 | Dependency / upload | Cao | `backend/src/modules/m1-core/routes/lessonRoutes.js:14-17,80-88`; dependency `multer@2.4.0` | `npm audit` báo GHSA-q7qp-rjg7-q26m: DoS liên quan async `fileFilter` sau request teardown. M1 dùng Multer trực tiếp cho upload. Cấu hình hiện tại **không** khai báo `fileFilter`, vì vậy điều kiện khai thác cụ thể của advisory chưa được xác nhận ở cấu hình ứng dụng; vẫn cần cập nhật dependency theo quy trình được duyệt. |
| M1-DEP-03 | Dependency / phân tích file | Trung bình | `backend/src/common/storage.js:140`; `backend/src/modules/m1-core/services/lessonService.js:12-16,157-163`; dependency `file-type@16.5.4` | `npm audit` báo GHSA-5v7r-6r5c-r473: vòng lặp vô hạn khi parser ASF gặp sub-header kích thước 0. M1 gọi `FileType.fromBuffer` trên bytes upload trước khi xác nhận magic MIME; uploader đã đăng nhập có thể đưa dữ liệu không tin cậy tới parser. |
| M1-DEP-04 | Dependency / điều hướng frontend | Trung bình | `frontend/src/modules/m1/pages/LoginPage.jsx:4-15,68,76`; dependency `react-router-dom@6.30.6` / `react-router@6.30.6` | `npm audit` báo GHSA-wrjc-x8rr-h8h6 về open redirect qua backslash và GHSA-337j-9hxr-rhxg về deserialize lỗi SSR. M1 dùng React Router; đường chuyển hướng đăng nhập hiện gọi `getSafeRedirectPath`, loại backslash và URL ngoài. Không xác nhận được callsite M1 có thể khai thác advisory trong rà soát này; đây là dependency advisory cần theo dõi, không phải lỗ hổng ứng dụng đã tái hiện. |
| M1-PERF-01 | Tìm kiếm / sắp xếp danh sách user | Trung bình | `backend/src/modules/m1-core/repositories/userRepository.js:38-71`; migration `database/migrations/202611010900_m1_create_core_tables.sql:25-42` | Tìm kiếm dùng `LIKE '%term%'` trên username, email và full name; các index username/email không hỗ trợ hiệu quả wildcard đầu chuỗi. Query đếm và query trang chạy riêng; query trang sắp theo `created_at, id`, nhưng migration không có index tương ứng. `EXPLAIN` test ghi nhận `Using filesort`. |
| M1-PERF-02 | Danh sách không giới hạn | Trung bình | `backend/src/modules/m1-core/repositories/courseRepository.js:32-61`; `lessonRepository.js:33-40`; `scheduleRepository.js:133-140` | Danh sách khóa học theo role, bài học theo khóa và lịch học theo khóa trả toàn bộ kết quả; các endpoint này không có limit/pagination. Một khóa hoặc tài khoản tích lũy nhiều dữ liệu sẽ làm response, cấp phát object và tải giao diện tăng theo tổng số bản ghi. Endpoint lịch học tổng hợp của sinh viên đã có phân trang; phát hiện này không áp dụng cho endpoint đó. |
| M1-PERF-03 | Bộ nhớ khi upload | Trung bình | `backend/src/modules/m1-core/routes/lessonRoutes.js:14-17,80-88`; `backend/src/modules/m1-core/services/lessonService.js:12`; `backend/src/common/storage.js:105-174` | Multer giữ file trong RAM với giới hạn 50 MiB mỗi request. Sau đó M1 tiếp tục giữ buffer để nhận dạng nội dung và ghi file. Route yêu cầu xác thực và vai trò giảng viên, nhưng nhiều upload đồng thời vẫn tiêu thụ bộ nhớ theo tổng kích thước các request. |

## 2. Tái hiện các phát hiện bảo mật mức Cao và Trung bình

Chỉ tái hiện trong môi trường local/staging cô lập với tài khoản, dữ liệu và
files thử nghiệm; không thực hiện trên production.

### M1-SEC-01 — JWT secret mặc định khi thiếu NODE_ENV

1. Dùng một backend thử nghiệm và database dùng riêng; bảo đảm không có
   `NODE_ENV` hoặc `JWT_SECRET` trong environment hay các tệp `.env` mà
   `common/config.js` nạp.
2. Khởi động backend. Cấu hình hiện tại chọn `development` và secret mặc định
   thay vì dừng khởi động.
3. Dùng một tài khoản Admin thử nghiệm đang hoạt động và giá trị
   `token_version` hiện tại để kiểm tra trong harness local: JWT ký bằng secret
   mặc định, claim `role=ADMIN`, được middleware xác thực chấp nhận.
4. Gửi `GET /api/users` trên chính backend thử nghiệm với token đó. Nếu nhận
   `200`, điều kiện giả mạo quyền đã được xác nhận. Không dùng tài khoản hoặc
   token ngoài môi trường thử nghiệm.

**Khắc phục đề xuất:** fail closed khi môi trường không phải test nhưng thiếu
`NODE_ENV`/secret; chỉ cho phép secret mặc định ở môi trường local/test rõ ràng.

### M1-SEC-02 — Khóa tài khoản bằng các lần đăng nhập sai

1. Tạo hoặc chọn một tài khoản thử nghiệm `ACTIVE`.
2. Gửi tuần tự năm request `POST /api/auth/login` với username của tài khoản
   đó và mật khẩu sai, trong vòng 10 phút. Dùng một IP và không gửi quá giới
   hạn 5 request/phút.
3. Quan sát lần thứ năm trả lỗi khóa tạm thời; thử đăng nhập lại với mật khẩu
   đúng ngay sau đó. Tài khoản tiếp tục bị khóa tối đa 15 phút.

**Khắc phục đề xuất:** đánh giá lại khóa cứng theo tài khoản; cân nhắc delay
tăng dần, kết hợp giới hạn theo IP và tài khoản, cảnh báo/khôi phục an toàn.
Nếu giữ nghiệp vụ khóa hiện tại, ghi nhận rõ khả năng attacker chủ động khóa
tài khoản như một rủi ro được chấp nhận.

### M1-DEP-01 / M1-DEP-02 / M1-DEP-03 — Dependency advisories

- Tái xác nhận kết quả dependency bằng `npm audit --omit=dev --prefix backend`.
  Lệnh trả exit 1 và liệt kê body-parser (High), Multer (High) và file-type
  (Moderate).
- Để kiểm tra ảnh hưởng runtime, chỉ dùng reproduction/test case do upstream
  advisory cung cấp trên bản sao local cô lập. Với Multer, lưu ý M1 hiện không
  cấu hình async `fileFilter`; advisory cụ thể chưa được xác nhận có thể kích
  hoạt trên request của M1.
- Không gửi compressed request lỗi hoặc file parser độc hại tới máy chủ dùng
  chung/production. Không chạy `npm audit fix` trong nhiệm vụ audit này.

### M1-DEP-04 — React Router advisory

1. Xác nhận bằng `npm audit --omit=dev --prefix frontend` (exit 1).
2. Rà soát các điều hướng M1: `LoginPage` lọc `location.state.from` qua
   `getSafeRedirectPath`; các link khóa học/bài học được dựng từ ID; link lịch
   chỉ nhận URL có scheme HTTP(S) và mở với `rel="noopener noreferrer"`.
3. Không tìm thấy đường M1 để đưa chuỗi backslash không tin cậy vào `Link` hoặc
   `useNavigate`; vì vậy advisory được báo ở mức dependency, chưa tái hiện thành
   open redirect của ứng dụng.

## 3. Hiệu năng và execution plan

### User search và lọc

Truy vấn chính được chọn là danh sách user Admin với tìm kiếm contains, role và
status filters; cấu trúc theo `UserRepository.list`:

```sql
EXPLAIN
SELECT u.id, u.username, u.email, u.full_name, u.status, r.name AS role
FROM users u
JOIN roles r ON r.id = u.role_id
WHERE u.deleted_at IS NULL
  AND (u.username LIKE '%seed%' OR u.email LIKE '%seed%' OR u.full_name LIKE '%seed%')
  AND r.name = 'SINH_VIEN'
  AND u.status = 'ACTIVE'
ORDER BY u.created_at DESC, u.id DESC
LIMIT 20 OFFSET 0;
```

Đã chạy `EXPLAIN` cho query trang và query `COUNT(*)` tương ứng trên
`lms_e2e` (không reset DB, chỉ đọc):

| Query/table | Access type | Key | Estimated rows | Extra |
|---|---|---|---:|---|
| Count — `roles` | `const` | `name` | 1 | `Using index` |
| Count — `users` | `ref` | `fk_users_role` | 3 | `Using where` |
| Page — `roles` | `const` | `name` | 1 | `Using index` |
| Page — `users` | `ref` | `fk_users_role` | 3 | `Using where; Using filesort` |

Database E2E tại thời điểm kiểm tra chỉ có dữ liệu seed quy mô nhỏ; plan này
không đại diện tải production. Kết quả xác nhận truy vấn trang cần filesort
ngay cả với tập dữ liệu nhỏ. Khi tăng số user, wildcard đầu chuỗi buộc lọc
contains phải kiểm tra nhiều bản ghi role phù hợp; phép đếm không được giới
hạn bởi `LIMIT`.

**Khuyến nghị:** đo trên dữ liệu đại diện; nếu tìm kiếm contains là yêu cầu
sản phẩm, cân nhắc full-text/search chuyên dụng hoặc cách tìm kiếm có prefix.
Đánh giá composite index phù hợp với lọc/sắp xếp sau khi có plan dữ liệu lớn;
không thêm index chỉ dựa trên plan seed hiện tại.

### Các danh sách trả không phân trang

Trên database thử nghiệm, tạo dữ liệu lớn bằng fixture rồi đo thời gian, số byte
response và heap cho:

1. `GET /api/courses` với Admin hoặc tài khoản có nhiều khóa học.
2. `GET /api/courses/{courseId}/lessons` với một khóa có nhiều bài học và tài
   liệu.
3. `GET /api/courses/{courseId}/schedules` với một khóa có lịch sử lịch học
   dài.

Hiện các repository không có `LIMIT`; so sánh kích thước response và bộ nhớ
theo số lượng record. Không chạy benchmark tải lớn trên môi trường dùng chung.

### Upload giữ buffer trong bộ nhớ

Trên local/staging, dùng tài khoản giảng viên thử nghiệm và lesson thử nghiệm;
gửi một request upload gần giới hạn 50 MiB, sau đó lặp có kiểm soát vài request
đồng thời. Theo dõi RSS/heap và thời gian xử lý. Mỗi request có thể giữ buffer
trong RAM tới hết quá trình nhận dạng/ghi file. Không thực hiện stress test
trên production.

## 4. Kết quả `npm audit`

Không chạy `npm audit fix`; các lệnh trả exit 1 do có advisory.

| Lệnh | Kết quả | Đánh giá |
|---|---|---|
| `npm audit --prefix backend` | **13 vulnerabilities:** 11 Moderate, 2 High | Có 2 High runtime (`body-parser@1.20.8`, `multer@2.4.0`); Moderate gồm `file-type@16.5.4` và các dependency khác. |
| `npm audit --omit=dev --prefix backend` | **3 vulnerabilities:** 1 Moderate, 2 High | Các dependency runtime nêu trên vẫn có trong production tree. |
| `npm audit --prefix frontend` | **18 vulnerabilities:** 14 Moderate, 1 High, 3 Critical | Các Critical/High nằm trong cây công cụ dev/test như Vitest, Tinypool và Vite; không đồng nghĩa chúng được gửi trong bundle production. |
| `npm audit --omit=dev --prefix frontend` | **2 Moderate** | `react-router-dom@6.30.6` phụ thuộc `react-router@6.30.6`; các advisory gồm open redirect via backslash và SSR error deserialization. |

Nên cập nhật dependency qua PR được duyệt, kiểm tra breaking changes và chạy
test/build; không thay dependency trong phạm vi audit chỉ đọc này.

## 5. Các kiểm tra không ghi nhận lỗi

- Các route quản lý user yêu cầu xác thực và vai trò Admin; route tạo/chỉnh sửa
  khóa học yêu cầu vai trò Giảng viên. Service kiểm tra chủ khóa học hoặc
  membership trước khi đọc dữ liệu khóa học, bài học và tải material.
- Các truy vấn M1 truyền dữ liệu đầu vào bằng placeholders; tìm kiếm user chỉ
  ghép cấu trúc filter cố định, không ghép search string vào SQL syntax.
- Danh sách sinh viên không nhận enrollment key; `CourseService` xóa enrollment
  key khỏi response sinh viên. Material response xóa `storedName`, storage dùng
  tên UUID, kiểm tra extension/magic MIME, giới hạn kích thước và lưu ngoài
  source/web root.
- JWT middleware xác minh chữ ký, role hợp lệ, trạng thái user và
  `token_version`. Đổi role/status và logout tăng version/thu hồi refresh
  tokens.
- Port `courseAccess` do M1 đăng ký trả các trường course tối thiểu và các
  phép kiểm tra owner/enrollment; các module tiêu thụ Port nội bộ qua registry.
  Các Port usage liên module thiếu provider được M1 xử lý theo hướng lưu trữ/
  archive an toàn thay vì hard-delete.
- Các endpoint M1 đã đối chiếu có trong `docs/openapi/m1.yaml`; phân trang
  `/api/users` và `/api/me/schedule` khớp giới hạn tối đa 100. Không phát hiện
  sai lệch hợp đồng nghiêm trọng trong các luồng đã rà soát.

## 6. Giới hạn

- Không kiểm thử xâm nhập trên máy chủ dùng chung; không chạy payload DoS hoặc
  file parser độc hại.
- `EXPLAIN` dùng database `lms_e2e` với dữ liệu nhỏ, không đo latency/tải
  production.
- Audit chỉ đọc; không sửa mã M1, migration, dependencies, `common`, `shared`
  hoặc Port.
