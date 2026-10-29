# Báo cáo Kiểm tra Bảo mật và Hiệu năng Module M2 (Assessment & Gradebook)

- **Người thực hiện kiểm toán:** Developer phụ trách Module M1 (Độc lập đánh giá chéo)
- **Phương pháp & Tiêu chuẩn:** OWASP Top 10, CSDL MySQL Execution Plan (EXPLAIN), npm audit, Audit Checklist của Skill `security-performance-auditor`
- **Đối tượng kiểm toán:**
  - Backend: `backend/src/modules/m2-assessment/`
  - Frontend: `frontend/src/modules/m2/`
  - OpenAPI Spec: `docs/openapi/m2.yaml`
  - CSDL & Migrations: `database/migrations/*m2*`
  - Các cổng giao tiếp liên module (Port Contract): `courseAccess`, `quizResults`, `notifications`

---

## 1. Bảng Tổng hợp Phát hiện (Audit Findings Matrix)

| ID | Loại | Mức độ | Vị trí | Mô tả tóm tắt | Đề xuất khắc phục |
|---|---|---|---|---|---|
| **SEC-01** | XSS / Input Sanitization | **Cao** | `backend/src/modules/m2-assessment/utils/sanitizer.js` (L7-26) | Tự xây dựng regex làm sạch HTML thay vì dùng `common/sanitizeText`. Dễ bị bypass bằng payload lồng nhau hoặc thẻ HTML5/SVG dẫn đến Stored XSS. | Loại bỏ `utils/sanitizer.js`, chuyển sang dùng `common/sanitizeText` với whitelist rỗng. |
| **SEC-02** | Access Control / Broken Role Authorization | **Cao** | `backend/src/modules/m2-assessment/routes/assignmentRoutes.js` (L23, 30, 44, 60), `gradeRoutes.js` (L18, 26) | Route cho phép vai trò `ADMIN` nhưng Service chỉ kiểm tra `courseAccess.isOwner` dẫn đến việc Admin bị từ chối với lỗi 403 Forbidden. | Thêm điều kiện bypass kiểm tra `isOwner` nếu `user.role === 'ADMIN'`, hoặc loại bỏ `ADMIN` khỏi route nếu Admin không có quyền can thiệp. |
| **SEC-03** | Broken Access Control / Feature Gap | **Trung bình** | `backend/src/modules/m2-assessment/routes/gradeRoutes.js` (L18, 25) | Endpoint tải bài nộp `GET /submissions/:submissionId/download` chỉ cho phép Giảng viên/Admin, Sinh viên không thể tải lại bài nộp của chính mình. | Mở quyền cho Sinh viên nộp bài được tải lại tệp của mình (`student_id === req.user.id`). |
| **SEC-04** | Contract Drift / OpenAPI Discrepancy | **Trung bình** | `backend/src/modules/m2-assessment/routes/submissionRoutes.js` (L39) vs `docs/openapi/m2.yaml` (L79-90) | Lệch hợp đồng OpenAPI: Spec công bố `POST /api/assignments/{assignmentId}/submissions/me` nhưng backend hiện triển khai `POST /api/assignments/:assignmentId/submissions`. | Thống nhất lại định dạng URL giữa OpenAPI và Router backend. |
| **SEC-05** | Request Validation | **Thấp** | `backend/src/modules/m2-assessment/routes/assignmentRoutes.js` | Thiếu middleware `validate()` tập trung từ `common`, phụ thuộc hoàn toàn vào validation thủ công trong service. | Bổ sung middleware `validate()` với Zod schema để chặn sớm dữ liệu không hợp lệ. |
| **PERF-01** | Query Performance / Missing Index | **Cao** | `backend/src/modules/m2-assessment/repositories/gradebookRepository.js` (L20-35) | Truy vấn `findSubmissionsByCourse` bị **Full Table Scan** (`type: ALL`) và **Using filesort** trên bảng `submissions`. | Bổ sung composite index `(assignment_id, submitted_at DESC)` trên bảng `submissions`. |
| **PERF-02** | Database Performance / Large Tuple IN Query | **Trung bình** | `backend/src/modules/m2-assessment/repositories/classGradebookRepository.js` (L31-40) | Ghép chuỗi tuple `IN ((?, ?), ...)` với số lượng sinh viên x bài tập lớn có thể chạm giới hạn tham số và làm chậm bộ phân tích SQL. | Chuyển sang truy vấn theo danh sách `assignment_id IN (...)` và gom nhóm dữ liệu trên bộ nhớ ứng dụng. |
| **PERF-03** | Concurrency / Disk I/O inside Transaction | **Trung bình** | `backend/src/modules/m2-assessment/services/submissionService.js` (L115-174) | Ghi tệp vật lý 20MB (`storage.saveUpload`) được thực hiện bên trong Database Transaction khi đang giữ khóa `FOR UPDATE`. | Tách thao tác ghi tệp ra ngoài transaction, chỉ mở transaction để cập nhật thông tin trong CSDL. |
| **DEP-01** | Outdated Dependencies | **Cao** | `backend/package.json` & `frontend/package.json` | Kết quả `npm audit` phát hiện 3 lỗ hổng tại backend (`body-parser`, `multer`, `file-type`) và 9 lỗ hổng tại frontend (`vitest`, `vite`, `react-router`). | Lên kế hoạch cập nhật dependency định kỳ theo phê duyệt dự án. |

---

## 2. Chi tiết các Lỗi Mức Cao và Trung bình & Kịch bản Tái hiện

### 2.1. [SEC-01 - Mức Cao] Lỗ hổng Stored XSS do bộ lọc Regex tự chế
- **Vị trí:** [sanitizer.js](file:///d:/Project/QuanLyHocTap/backend/src/modules/m2-assessment/utils/sanitizer.js#L7-L26) & [assignmentService.js](file:///d:/Project/QuanLyHocTap/backend/src/modules/m2-assessment/services/assignmentService.js#L14)
- **Chi tiết lỗ hổng:**
  Module M2 tự triển khai hàm `sanitizeText` sử dụng các biểu thức chính quy (Regular Expressions) đơn lẻ:
  ```javascript
  let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/<\/?(iframe|object|embed|style|link|meta|base|form|input)[^>]*>/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*(['"]).*?\1/gi, '');
  ```
  Bộ lọc này dễ dàng bị vượt qua bằng:
  1. Thẻ lồng nhau: `<scr<script>ipt>alert(1)</script>` -> sau 1 lượt `replace`, chuỗi trở thành `<script>alert(1)</script>`.
  2. Sự kiện HTML5 không có dấu ngoặc kép hoặc dùng ký tự xuống dòng: `<img src=x onerror=alert(1)>` hoặc `<svg onload=alert(1)>`.
  Trong khi đó, dự án đã cung cấp sẵn [common/sanitizeText.js](file:///d:/Project/QuanLyHocTap/backend/src/common/sanitizeText.js) dùng `sanitize-html` tiêu chuẩn.
- **Kịch bản tái hiện (PoC):**
  1. Đăng nhập với quyền Giảng viên (`gv_mai`).
  2. Gửi request tạo bài tập với tiêu đề/mô tả chứa payload XSS lồng nhau:
  ```bash
  curl -X POST http://localhost:5000/api/courses/1/assignments \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <GIANG_VIEN_TOKEN>" \
    -d '{
      "title": "Bài tập 1 <scr<script>ipt>alert(\"XSS\")</script>",
      "description": "<svg onload=alert(document.cookie)>",
      "dueDate": "2026-12-01T00:00:00.000Z",
      "maxScore": 10
    }'
  ```
  3. Kết quả: Bài tập được lưu vào CSDL với mã độc còn nguyên vẹn, gây nguy cơ thực thi mã JavaScript khi sinh viên truy cập xem bài tập.
- **Cách khắc phục:**
  Tại [assignmentService.js](file:///d:/Project/QuanLyHocTap/backend/src/modules/m2-assessment/services/assignmentService.js), thay thế import:
  ```javascript
  // Thay vì: const { sanitizeText } = require('../utils/sanitizer');
  const sanitizeText = require('../../../common/sanitizeText');
  ```
  Và xóa bỏ tệp `backend/src/modules/m2-assessment/utils/sanitizer.js`.

---

### 2.2. [SEC-02 - Mức Cao] Lỗi từ chối quyền hạn Admin (403 Forbidden)
- **Vị trí:** [assignmentRoutes.js](file:///d:/Project/QuanLyHocTap/backend/src/modules/m2-assessment/routes/assignmentRoutes.js#L23), [gradeRoutes.js](file:///d:/Project/QuanLyHocTap/backend/src/modules/m2-assessment/routes/gradeRoutes.js#L18), [assignmentService.js](file:///d:/Project/QuanLyHocTap/backend/src/modules/m2-assessment/services/assignmentService.js#L50)
- **Chi tiết lỗ hổng:**
  Tại router, các hành động quản lý bài tập và chấm điểm cho phép `ADMIN`:
  ```javascript
  requireRole(['GIANG_VIEN', 'ADMIN'])
  ```
  Tuy nhiên ở tầng Service, logic kiểm tra bắt buộc người gọi phải là chủ sở hữu khóa học:
  ```javascript
  if (!(await courseAccessPort.isOwner(instructorId, courseId))) {
    throw new ForbiddenError('Chỉ chủ khóa học mới có quyền thực hiện thao tác này (BR-03).');
  }
  ```
  Vì Admin không phải là giảng viên giảng dạy của khóa học, `isOwner(adminId, courseId)` luôn trả về `false`, khiến Admin không thể thực hiện quyền quản trị hệ thống.
- **Kịch bản tái hiện:**
  1. Đăng nhập với tài khoản `admin`.
  2. Gửi request tạo bài tập hoặc chấm điểm cho khóa học bất kỳ:
  ```bash
  curl -X POST http://localhost:5000/api/courses/1/assignments \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <ADMIN_TOKEN>" \
    -d '{
      "title": "Bài tập do Admin tạo",
      "dueDate": "2026-12-01T00:00:00.000Z",
      "maxScore": 10
    }'
  ```
  3. Kết quả: Phản hồi trả về HTTP 403 Forbidden: `"Chỉ chủ khóa học mới có quyền thực hiện thao tác này (BR-03)."`.
- **Cách khắc phục:**
  Trong `_assertCourseOwner`, bổ sung kiểm tra vai trò:
  ```javascript
  if (callerRole === 'ADMIN') return;
  ```
  Hoặc nếu hệ thống quy định Admin không được can thiệp vào khóa học, loại bỏ `ADMIN` khỏi `requireRole(['GIANG_VIEN'])`.

---

### 2.3. [SEC-03 - Mức Trung bình] Sinh viên không thể tải lại tệp bài nộp của mình
- **Vị trí:** [gradeRoutes.js](file:///d:/Project/QuanLyHocTap/backend/src/modules/m2-assessment/routes/gradeRoutes.js#L18-L25)
- **Chi tiết lỗ hổng:**
  Endpoint tải bài nộp `GET /api/submissions/:submissionId/download` đặt middleware:
  ```javascript
  const gradersOnly = [requireAuth, requireRole(['GIANG_VIEN', 'ADMIN'])];
  router.get('/submissions/:submissionId/download', ...gradersOnly, controller.downloadSubmission);
  ```
  Sinh viên khi cần tải lại tệp đã nộp để đối chiếu kết quả không có quyền truy cập endpoint này và nhận lỗi 403.
- **Kịch bản tái hiện:**
  1. Sinh viên `sv_nam` đăng nhập và nộp bài thành công (nhận `submissionId = 10`).
  2. Sinh viên gửi request tải lại tệp của mình:
  ```bash
  curl -X GET http://localhost:5000/api/submissions/10/download \
    -H "Authorization: Bearer <SINH_VIEN_TOKEN>"
  ```
  3. Kết quả: Bị chặn bởi `requireRole` với mã lỗi HTTP 403 Forbidden.
- **Cách khắc phục:**
  Cho phép vai trò `SINH_VIEN` truy cập endpoint tải tệp và xác thực `submission.student_id === req.user.id` trong Service.

---

### 2.4. [SEC-04 - Mức Trung bình] Lệch chuẩn Hợp đồng API (OpenAPI vs Backend Router)
- **Vị trí:** [submissionRoutes.js](file:///d:/Project/QuanLyHocTap/backend/src/modules/m2-assessment/routes/submissionRoutes.js#L39) và [docs/openapi/m2.yaml](file:///d:/Project/QuanLyHocTap/docs/openapi/m2.yaml#L79-L90)
- **Chi tiết:**
  - Tài liệu hợp đồng `docs/openapi/m2.yaml` định nghĩa:
    `POST /api/assignments/{assignmentId}/submissions/me`
  - Thực tế backend triển khai:
    `POST /api/assignments/:assignmentId/submissions` (không có hậu tố `/me`).
- **Cách khắc phục:**
  Thêm route alias hoặc đồng bộ lại router của backend cho khớp chuẩn với tài liệu hợp đồng `m2.yaml`.

---

### 2.5. [PERF-01 - Mức Cao] Lỗi Full Table Scan và Filesort trên bảng `submissions`
- **Vị trí:** [gradebookRepository.js](file:///d:/Project/QuanLyHocTap/backend/src/modules/m2-assessment/repositories/gradebookRepository.js#L20-L35)
- **Bằng chứng kiểm thử thực tế (MySQL EXPLAIN):**
  ```text
  EXPLAIN SELECT s.id, s.assignment_id, a.title, s.student_id, s.submitted_at, g.score 
  FROM submissions s 
  INNER JOIN assignments a ON a.id = s.assignment_id 
  LEFT JOIN grades g ON g.submission_id = s.id 
  WHERE a.course_id = 1 
  ORDER BY s.submitted_at DESC, s.id DESC LIMIT 20 OFFSET 0;
  ```
  *Kết quả phân tích execution plan:*
  - Bảng `s` (`submissions`): `type = ALL`, `possible_keys = uk_assignment_student,idx_submissions_assignment_status`, `key = NULL`, `Extra = Using filesort`.
- **Hệ quả hiệu năng:**
  Khi giảng viên xem danh sách bài nộp của khóa học, MySQL buộc phải quét toàn bộ bảng `submissions` (toàn bộ bài nộp của tất cả khóa học trong hệ thống) rồi mới đưa vào bộ nhớ để filesort. Khi hệ thống có hàng chục nghìn bài nộp, endpoint này sẽ bị quá tải CPU và phản hồi rất chậm.
- **Cách khắc phục:**
  Tạo migration bổ sung chỉ mục tối ưu cho việc sắp xếp theo thời gian nộp:
  ```sql
  ALTER TABLE `submissions`
    ADD INDEX `idx_submissions_assignment_submitted` (`assignment_id`, `submitted_at` DESC, `id` DESC);
  ```

---

### 2.6. [PERF-02 - Mức Trung bình] Nối chuỗi cặp tuple `IN ((?, ?), ...)` quá dài
- **Vị trí:** [classGradebookRepository.js](file:///d:/Project/QuanLyHocTap/backend/src/modules/m2-assessment/repositories/classGradebookRepository.js#L31-L40)
- **Chi tiết:**
  Câu lệnh truy vấn điểm tổng hợp của lớp:
  ```javascript
  WHERE (s.`assignment_id`, s.`student_id`) IN (${pairs.join(', ')})
  ```
  Nếu lớp có 100 sinh viên và 15 bài tập, số lượng placeholder lên đến 3,000 tham số. Điều này gây tốn bộ nhớ phân tích cú pháp SQL trên máy chủ MySQL.
- **Cách khắc phục:**
  Chỉ lọc theo danh sách bài tập `s.assignment_id IN (?)` của khóa học, sau đó gom nhóm ánh xạ kết quả điểm sang từng sinh viên trong bộ nhớ đệm ứng dụng Node.js.

---

### 2.7. [PERF-03 - Mức Trung bình] Thực hiện Disk I/O bên trong Database Transaction
- **Vị trí:** [submissionService.js](file:///d:/Project/QuanLyHocTap/backend/src/modules/m2-assessment/services/submissionService.js#L146-L150)
- **Chi tiết:**
  Phương thức `this.storage.saveUpload(upload)` thực hiện đọc và ghi đĩa tệp đính kèm lên tới 20MB nằm **bên trong** khối `withTransaction`, đồng thời đang giữ khóa `FOR UPDATE` trên dòng bản ghi của `assignments` và `submissions`.
- **Hệ quả:**
  Giao dịch CSDL bị kéo dài trong suốt thời gian ghi đĩa. Khi nhiều sinh viên nộp bài đồng thời vào giờ chót, kết nối CSDL sẽ nhanh chóng cạn kiệt, gây nghẽn hàng đợi (connection pool exhaustion) và lỗi timeout.
- **Cách khắc phục:**
  Lưu tệp vào thư mục tạm/upload trước khi bắt đầu transaction CSDL:
  1. `const storedFile = await this.storage.saveUpload(upload, ...);`
  2. Mở `withTransaction`: Kiểm tra hạn nộp, lưu bản ghi vào CSDL.
  3. Nếu CSDL bị lỗi, kích hoạt rollback và xóa tệp vừa lưu trong khối `catch`.

---

## 3. Báo cáo Rà soát Dependency (`npm audit`)

Kết quả quét phụ thuộc bảo mật không xâm lấn (`--json`, không chạy audit fix):

### 3.1. Backend (`backend/package.json`):
- **Tổng số lỗ hổng:** 3 (2 High, 1 Moderate).
- **Chi tiết:**
  - `body-parser` (<1.20.9): Lỗ hổng DoS qua trailing bytes sau compressed body (CWE-248, CVSS 7.5 - High).
  - `multer` (>=2.0.0 <2.5.0): Lỗ hổng DoS do asynchronous fileFilter pending sau khi teardown request (CWE-248, CWE-404, CVSS 7.5 - High).
  - `file-type` (13.0.0 - 21.3.0): Lỗi Infinite loop trong bộ phân tích ASF parser với zero-size sub-header (CWE-835, CVSS 5.3 - Moderate).

### 3.2. Frontend (`frontend/package.json`):
- **Tổng số lỗ hổng:** 9 (3 Critical, 1 High, 5 Moderate) - chủ yếu nằm trong công cụ phát triển (`devDependencies`):
  - `vitest` / `@vitest/coverage-v8` / `@vitest/mocker`: Lỗ hổng Path Traversal & Arbitrary File Read (GHSA-82fw-gwwq-j7x9, GHSA-5xrq-8626-4rwp).
  - `vite`: Lỗ hổng bypass `server.fs.deny` trên Windows (GHSA-fx2h-pf6j-xcff).
  - `react-router`: Lỗ hổng Open Redirect và Constructor Injection (GHSA-wrjc-x8rr-h8h6).

---

## 4. Mục Rủi ro Đã biết & Khuyến nghị Bàn giao cho Chủ Module M2

1. **Tuân thủ ranh giới làm việc (AGENTS.md):**
   Người kiểm toán thuộc Module M1 tuân thủ tuyệt đối quy định chỉ đọc mã nguồn của Module M2, không tự ý sửa đổi mã nguồn hoặc migration của M2.
2. **Khuyến nghị ưu tiên xử lý cho Chủ Module M2:**
   - **Ưu tiên 1 (P1):** Thay thế ngay `utils/sanitizer.js` bằng `common/sanitizeText.js` để triệt tiêu nguy cơ Stored XSS.
   - **Ưu tiên 2 (P1):** Bổ sung index `idx_submissions_assignment_submitted` để khắc phục lỗi Full Table Scan của danh sách bài nộp.
   - **Ưu tiên 3 (P2):** Tách `saveUpload` ra khỏi transaction CSDL trong `submissionService.js` để đảm bảo hệ thống chịu tải tốt trong giờ cao điểm nộp bài.
   - **Ưu tiên 4 (P2):** Xử lý ngoại lệ cho tài khoản `ADMIN` trong `_assertCourseOwner`.

