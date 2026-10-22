# Hợp đồng liên module (Contracts) - LMS Mini

Tài liệu này là **nguồn sự thật** cho cách ba module M1, M2, M3 dùng chung hạ tầng và gọi nhau.
Đặt tại `docs/contracts.md`. Mọi thay đổi chữ ký phải có **cả 3 người đồng ý** (một PR riêng sửa tài liệu này
và `backend/src/contracts/`). Nếu `docs/architecture.md` quyết định khác, ưu tiên `architecture.md` và ghi rõ chỗ khác biệt ở cuối tài liệu này.

## 1. Nguyên tắc
1. Module **không import code của module khác**. Chỉ được import từ `backend/src/common` và `backend/src/contracts`.
2. Module cần dữ liệu của module khác thì gọi **Port** (mục 4) qua `getPort(tên)`.
3. Mỗi Port có **bản giả (fake)** trong `backend/src/contracts/fakes/` để bên dùng viết test và chạy khi bên cung cấp chưa merge.
4. Không join trực tiếp sang bảng của module khác trong truy vấn nghiệp vụ; lấy dữ liệu qua Port.
5. Kiểm tra bằng `npm run deps:check` trước mỗi PR.

## 2. Nạp module và đường dẫn
- Mọi module mount router tại **`/api`** (không có tiền tố tên thư mục). Mỗi module tự khai báo đường dẫn tài nguyên đầy đủ
  (ví dụ `/courses/:courseId/assignments`). Đường dẫn chính xác lấy từ `docs/diagrams/sequence.puml`.
- Module export `{ router, init }`; `init(ctx)` (không bắt buộc) chạy khi khởi động, dùng để đăng ký Port và khởi động job nền.
- Khi khởi động, loader **báo lỗi nếu hai module khai báo trùng `METHOD + đường dẫn`**.
- Route kiểm tra giữ nguyên: `GET /api/<tên-thư-mục-module>/ping`.

### Sở hữu prefix đường dẫn
| Module | Chủ | Đường dẫn được phép khai báo (sau `/api`) |
|---|---|---|
| M1 core | A | `/auth/**`, `/users/**`, `/courses` và `/courses/:courseId` (CRUD, xuất bản, lưu trữ), `/courses/:courseId/enrollments/**`, mọi route ghi danh, `/courses/:courseId/lessons/**`, `/lessons/**`, `/materials/**`, `/courses/:courseId/schedules/**`, `/schedules/**`, `/me/schedule` |
| M2 assessment | B | `/courses/:courseId/assignments/**`, `/assignments/**`, `/submissions/**`, `/courses/:courseId/grades/**`, `/me/grades` |
| M3 quiz | C | `/courses/:courseId/quizzes/**`, `/quizzes/**`, `/questions/**`, `/attempts/**`, `/courses/:courseId/announcements/**`, `/announcements/**`, `/lessons/:lessonId/comments/**`, `/comments/**`, `/notifications/**` |

## 3. Hạ tầng dùng chung `backend/src/common` (chủ: A)
Các module `require('../../common')`. A là người duy nhất sửa thư mục này.

| Thành phần | Chữ ký | Ghi chú |
|---|---|---|
| `requireAuth` | middleware | Gắn `req.user = { id, role }`; 401 nếu thiếu/hết hạn token; từ chối tài khoản `LOCKED`/`TEMPORARY_LOCKED` |
| `requireRole(...roles)` | middleware | `role` thuộc `ADMIN`, `GIANG_VIEN`, `SINH_VIEN`; 403 nếu sai vai trò |
| Lỗi | `BadRequestError`(400), `UnauthorizedError`(401), `ForbiddenError`(403), `NotFoundError`(404), `ConflictError`(409), `ValidationError`(422, có `details`) | Bộ xử lý lỗi trả `{ code, message, details }` |
| `validate(schema)` | middleware | Kiểm tra body, query, params |
| `withTransaction(fn)` | `(conn) => Promise<T>` | Mở, commit, tự rollback khi có lỗi |
| `clock.now()` | `Date` | Giờ SERVER, múi giờ Asia/Ho_Chi_Minh theo quyết định trong architecture.md. Mọi so sánh hạn nộp, giờ thi đều dùng hàm này để test giả lập thời gian |
| `sanitizeText(s)` | `string` | Chống XSS (BR-18) |
| `storage.saveUpload(file, { allowedExt, allowedMime, maxBytes })` | `{ storedName, originalName, mime, size }` | Kiểm tra extension và magic bytes, tên UUID, lưu ngoài web root (BR-10, NFR-07). Nếu lỗi thì không để lại tệp |
| `storage.openReadStream(storedName)` | `ReadStream` | Chỉ dùng SAU khi đã kiểm tra quyền (BR-11) |
| `storage.deleteFile(storedName)` | `Promise` | Dùng để dọn tệp mồ côi (EC-19) |
| `rateLimit(name, { windowMs, max })` | middleware | Theo user hoặc IP |
| `logger`, `config` | | Cấu hình đọc từ `.env` |

## 4. Port giữa các module
### 4.1 Registry (`backend/src/contracts/index.js`)
```
registerPort(name, impl)
getPort(name, { optional = false })   // optional=true: trả null nếu chưa có bên cung cấp (chỉ dùng khi phát triển)
```
- Bên cung cấp gọi `registerPort` trong `init()` của module mình.
- Bên dùng gọi `getPort` **tại thời điểm xử lý request** (không gọi ở mức module khi nạp file).
- Test: `registerPort('courseAccess', fakeCourseAccess)`.

### 4.2 Port `courseAccess` (cung cấp: M1 / A; dùng: M2, M3)
| Hàm | Trả về |
|---|---|
| `getCourse(courseId)` | `{ id, ownerId, title, status: 'DRAFT'\|'PUBLISHED'\|'ARCHIVED' }` hoặc `null` (không trả khóa đã xóa mềm) |
| `isOwner(userId, courseId)` | `boolean` (BR-03) |
| `isEnrolled(userId, courseId)` | `boolean` (BR-05) |
| `assertCourseWritable(courseId)` | ném `ConflictError` mã `COURSE_ARCHIVED` nếu khóa học đã lưu trữ hoặc không tồn tại (chế độ chỉ đọc, EC-09) |
| `getEnrolledStudentIds(courseId)` | `Promise<number[]>` |
| `listEnrolledStudents(courseId, { page = 1, limit = 20 })` | `{ items: [{ id, username, fullName }], total }` |
| `getUsersBrief(userIds[])` | `[{ id, username, fullName, role }]` (một truy vấn cho cả danh sách, tránh N+1) |
| `getLessonSummary(lessonId)` | `{ id, courseId }` hoặc `null` |

Quy tắc kiểm tra quyền ở module dùng: `getCourse` (tồn tại) -> `isOwner` hoặc `isEnrolled` -> `assertCourseWritable` cho thao tác ghi.
Admin được xem nhưng quyền ghi theo từng story trong PRD.

### 4.3 Port `quizResults` (cung cấp: M3 / C; dùng: M2 cho bảng điểm US-13, US-14)
| Hàm | Trả về |
|---|---|
| `getQuizScoresForCourse(courseId, studentIds[])` | Mảng phần tử bên dưới, **một truy vấn** cho cả lớp (EC-21) |
| `getQuizScoresForStudent(courseId, studentId)` | Mảng phần tử bên dưới của một sinh viên |

Phần tử: `{ studentId, quizId, quizTitle, maxScore: 10, score: number | null, attemptStatus: 'SUBMITTED'|'AUTO_SUBMITTED'|null, submittedAt: ISO|null, visibleToStudent: boolean }`
- Chưa làm bài: `score = null` và `attemptStatus = null` (khác với 0 điểm).
- Chỉ gồm đề đã công bố (không gồm đề nháp).
- Sinh viên chỉ thấy điểm khi `visibleToStudent = true` (cờ cho phép xem điểm ngay hoặc đề đã đóng); giảng viên luôn thấy.

### 4.4 Port `notifications` (cung cấp: M3 / C; dùng: M1, M2, M3)
| Hàm | Mô tả |
|---|---|
| `notifyUser(userId, payload)` | Thông báo cho một người |
| `notifyCourseStudents(courseId, payload)` | Thông báo cho mọi sinh viên đã ghi danh (lấy danh sách qua `courseAccess.getEnrolledStudentIds`) |

`payload = { type, title, message, refType, refId, link }`, `type` thuộc `NEW_ASSIGNMENT`, `ASSIGNMENT_GRADED`, `ANNOUNCEMENT`, `SCHEDULE_CHANGED`.
- **Best effort:** bên cung cấp bắt lỗi và ghi log, không ném lỗi ra ngoài. Bên dùng gọi **sau khi giao dịch đã commit**.
- Nếu `architecture.md` hoặc `design-review.md` chọn cách khác cho thông báo (ví dụ dùng bảng bảng tin thay vì bảng riêng), bên cung cấp vẫn giữ nguyên chữ ký này.

### 4.5 Port `assessmentUsage` và `quizUsage`

- **Mục đích:** để M1 thực hiện NFR-09 và EC-09 (khóa học hoặc tài khoản đã có dữ liệu phát sinh thì chỉ được lưu trữ hoặc xóa mềm, không xóa cứng) mà không truy vấn bảng của module khác.
- Hai Port cùng hình dạng. `assessmentUsage` do M2 cung cấp; `quizUsage` do M3 cung cấp.
  - `hasCourseData(courseId)` -> `Promise<boolean>`. M2 trả `true` nếu khóa có ít nhất một bài tập hoặc bài nộp. M3 trả `true` nếu có ít nhất một đề thi hoặc lượt thi.
  - `hasUserData(userId)` -> `Promise<boolean>`. Trả `true` nếu người dùng có bản ghi do mình tạo hoặc thuộc về mình trong module đó. M2 kiểm tra bài nộp, bài tập đã giao hoặc đã chấm; M3 kiểm tra lượt thi, đề thi, thông báo hoặc bình luận.
- **Quy tắc ở M1 (bên dùng):** có dữ liệu khi dữ liệu của M1 hoặc `assessmentUsage` hoặc `quizUsage` báo có. M1 gọi `getPort(tên, { optional: true })`. Port chưa đăng ký (`null`) được coi là **có dữ liệu** để bảo đảm chỉ lưu trữ hoặc xóa mềm, không xóa cứng.
- Có dữ liệu: khóa học chỉ được chuyển sang `ARCHIVED`; tài khoản chỉ được khóa hoặc xóa mềm. Không có dữ liệu: được xóa mềm theo quyết định trong `architecture.md`. Không có xóa cứng trong MVP.

## 5. Mốc bàn giao
| Mốc | Ai giao | Ai cần |
|---|---|---|
| Ngày 0: loader mount `/api`, registry và fake của 3 Port, common (lỗi, auth khung, storage, clock, rateLimit), thư viện dùng chung, Swagger UI | A | B, C |
| `requireAuth`, `requireRole` chạy thật (US-01) | A | B, C |
| `courseAccess` thật (sau US-03, US-04) | A | B, C |
| `assessmentUsage` thật | B | A (trước thao tác xóa mềm tài khoản/khóa học) |
| `quizUsage` thật | C | A (trước thao tác xóa mềm tài khoản/khóa học) |
| `notifications` thật (bản tối thiểu) | C | A, B |
| `quizResults` thật (sau US-12) | C | B (US-13, US-14) |

Trước các mốc trên, dùng fake trong `backend/src/contracts/fakes/`.

## 6. Ghi chú khác biệt so với architecture.md
(Điền tại đây nếu có.)
