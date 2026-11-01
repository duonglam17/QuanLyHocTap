# Báo cáo kiểm tra bảo mật và hiệu năng Module M3

- **Ngày kiểm tra:** 2026-11-01
- **Phạm vi:** `backend/src/modules/m3-quiz/`, `frontend/src/modules/m3/`,
  `docs/openapi/m3.yaml`, các migration M3, cách M3 dùng `common`, `shared` và
  Port liên module.
- **Phương pháp:** rà soát quyền/IDOR, xác thực dữ liệu, SQL parameterization,
  XSS, thời gian thi và lộ đáp án; đọc migration/index; `npm audit` ở backend
  và frontend. Không sửa mã M3, không chạy `npm audit fix`.

## 1. Bảng phát hiện

| ID | Loại | Mức độ | Vị trí | Mô tả | Cách khắc phục |
|---|---|---|---|---|---|
| M3-PERF-01 | Hiệu năng / phản hồi không giới hạn | Trung bình | `backend/src/modules/m3-quiz/repositories/discussionRepository.js:33-67`; `frontend/src/modules/m3/components/DiscussionSection.jsx:25,55-56,186-199` | API phân trang chủ đề gốc nhưng truy vấn replies trả mọi reply của tối đa 100 chủ đề, không có giới hạn hoặc phân trang replies. Một chủ đề hoạt động lâu có thể làm một request kéo về và render toàn bộ replies, tăng truy vấn DB, bộ nhớ và kích thước phản hồi theo tổng lịch sử reply. | Phân trang replies hoặc chỉ trả số lượng/preview; giới hạn rõ số replies mỗi chủ đề và bổ sung thao tác tải tiếp. Cân nhắc giới hạn tần suất tạo nội dung ở tầng chung nếu chính sách sản phẩm yêu cầu. |
| M3-PERF-02 | Hiệu năng / fan-out theo toàn bộ roster | Trung bình | `backend/src/modules/m3-quiz/repositories/quizResultsRepository.js:14-42`; lời gọi M2 tại `backend/src/modules/m2-assessment/services/classGradebookService.js:147-153` | Port `getQuizScoresForCourse` sinh một `SELECT ?` cho mỗi sinh viên trong danh sách đầu vào rồi ghép bằng `UNION ALL`. Bên gọi truyền toàn bộ ID sinh viên ghi danh, kể cả khi chỉ cần một trang 20 sinh viên. Kích thước SQL và số hàng xử lý/tải về tăng theo toàn bộ roster × số quiz; không có chunk/cap tại Port. | Thiết kế Port nhận trang ID sinh viên cần hiển thị hoặc truy vấn trực tiếp theo `course_id` và tập ID phân trang; nếu cần xuất toàn bộ roster thì xử lý theo batch có giới hạn. |
| M3-PERF-03 | Hiệu năng / index cho lọc và sắp thứ tự | Thấp | `backend/src/modules/m3-quiz/repositories/discussionRepository.js:36-50`; `database/migrations/202611011100_m3_create_quiz_interaction_tables.sql:127-130` | Truy vấn chủ đề gốc lọc `lesson_id` và `parent_discussion_id IS NULL`, rồi sắp theo `created_at, id`. Migration có index theo `course_id, created_at`; migration replies có index `(parent_discussion_id, created_at, id)`, nhưng không khai báo index bao phủ đầy đủ lọc/sắp thứ tự danh sách gốc theo lesson. Có thể phải lọc/sắp thêm trên các chủ đề của lesson. Mức độ thực tế cần xác nhận bằng execution plan và dữ liệu đại diện. | Sau khi đo trên MySQL với dữ liệu đại diện, cân nhắc composite index bắt đầu bằng `lesson_id, parent_discussion_id`, tiếp theo là cột sắp thứ tự phù hợp. Không thêm index chỉ dựa trên giả định; kiểm tra tác động ghi và kích thước index. |

### Cách tái hiện các phát hiện hiệu năng

Chỉ thực hiện trên database test/E2E cô lập, không dùng dữ liệu production:

1. **M3-PERF-01:** Tạo một lesson, một chủ đề gốc và nhiều replies bằng fixture
   test. Gọi một lần `GET /api/lessons/{lessonId}/comments?page=1&limit=20`.
   Kiểm tra response: dù `limit` giới hạn chủ đề gốc, `replies` của từng chủ
   đề vẫn chứa mọi reply liên quan. Đối chiếu số bytes/thời gian với fixture có
   ít reply hơn.
2. **M3-PERF-02:** Tạo course test có roster lớn và ít nhất một quiz đã công
   bố. Gọi trang đầu bảng điểm lớp (20 sinh viên) qua API test. Theo dõi query
   M3: số placeholder trong `requestedStudents` bằng số ID roster được Port
   nhận và số hàng kết quả vượt kích thước trang cần hiển thị. Tái hiện không
   yêu cầu gọi lặp tải cao.
3. **M3-PERF-03:** Trên MySQL test sau migration, chạy `EXPLAIN` với truy vấn
   root-discussion tương ứng:

   ```sql
   EXPLAIN
   SELECT id, course_id, lesson_id, author_id, content, created_at, updated_at
   FROM discussions
   WHERE lesson_id = 1 AND parent_discussion_id IS NULL
   ORDER BY created_at DESC, id DESC
   LIMIT 20 OFFSET 0;
   ```

   **Không chạy được trong môi trường kiểm tra này:** `backend/.env` và
   `e2e/.env.e2e` không có; `localhost:3306` không lắng nghe; MySQL/MariaDB CLI
   không được cài. Vì vậy không có execution plan thực tế, không kết luận
   optimizer chắc chắn full-scan/filesort và không đề xuất coi đó là kết quả
   EXPLAIN đã xác minh. Cần chạy truy vấn trên database test với dữ liệu đại
   diện trước khi quyết định index.

## 2. Kết quả rà soát bảo mật

- **Phân quyền/IDOR:** các routes quiz/attempt/discussion/announcement áp dụng
  authentication và role middleware. Service quiz kiểm tra chủ khóa hoặc ghi
  danh; service attempt đối chiếu student ID của attempt; notification truy vấn
  và cập nhật theo cả notification ID lẫn user ID. Không xác nhận được đường
  truy cập chéo dữ liệu trong mã đã đọc.
- **Lộ đáp án:** câu hỏi trong lượt thi lấy từ `attemptRepository.listQuestions`
  không chọn `is_correct`; service không trả answer key cho sinh viên. Kết quả
  và điểm được chặn bởi quyền người thi/chủ khóa và điều kiện công bố. Không
  xác nhận được lộ đáp án trước thời điểm cho phép.
- **SQL injection:** giá trị truy vấn trong repositories được truyền qua
  placeholders. Phần SQL dựng động trong discussion và quizResults chỉ dựng
  số lượng placeholder từ danh sách ID, không ghép nội dung người dùng thành
  cú pháp SQL; rủi ro của hai truy vấn đó là fan-out hiệu năng nêu trên.
- **XSS:** nội dung quiz/announcement/discussion được làm sạch bằng
  `common.sanitizeText`; frontend M3 render bằng JSX text, không thấy
  `dangerouslySetInnerHTML` hoặc `innerHTML`. `NotificationBell` lọc `link`
  bằng `getSafeRedirectPath` trước khi điều hướng.
- **Thời gian thi và đồng thời:** server dùng clock qua `common`, khóa attempt
  khi cập nhật, so sánh hạn ở server và dùng điều kiện cập nhật trạng thái
  `IN_PROGRESS`; takeover kiểm tra token phiên cũ và giới hạn số lần takeover.
- **Đầu vào/phân trang:** các route M3 có Zod validation; danh sách quiz,
  notification, announcement và root discussions giới hạn `limit` tối đa 100.
  Riêng replies không được giới hạn như M3-PERF-01.
- **Migration:** migration M3 bổ sung unique key cho một attempt trên quiz và
  một câu trả lời trên mỗi câu hỏi trong attempt; có index cho attempt hết hạn,
  quiz theo course/status và replies. Chưa xác minh execution plan trên MySQL
  thật.

Không ghi nhận lỗ hổng mức Cao có bằng chứng trong phần mã M3 đã kiểm tra.

## 3. `npm audit` — kết quả dependency

Đã chạy các lệnh sau, không chạy lệnh sửa dependency:

| Lệnh | Kết quả | Ghi chú |
|---|---|---|
| `Set-Location backend; npm audit` | **Exit 1 — 13 vulnerabilities:** 11 moderate, 2 high | High: `body-parser` (DoS khi xử lý compressed request có trailing bytes; advisory GHSA-27r3-jxmh-p828) và `multer` (DoS với async `fileFilter` sau request teardown; GHSA-q7qp-rjg7-q26m). Moderate gồm `file-type`, `minimatch` và chuỗi công cụ lint/dev liên quan. |
| `Set-Location frontend; npm audit` | **Exit 1 — 18 vulnerabilities:** 14 moderate, 1 high, 3 critical | Critical gồm `vitest`, `@vitest/coverage-v8`, `tinypool` (các advisory RCE/path traversal thuộc test tooling); high là `vite` (các advisory ở dev server/Windows path/editor); moderate gồm `react-router` (open redirect/SSR advisory), `esbuild`, `@vitest/mocker`, `glob`, `minimatch` và tooling liên quan. |

Đây là kết quả trên toàn dependency tree của hai workspace, gồm cả dev/test
dependencies; không phải tất cả đều nằm trong runtime production hoặc thuộc
riêng module M3. Cần chủ sở hữu hạ tầng/dependency lên kế hoạch cập nhật có kiểm
thử tương thích. Một số đường sửa do npm đề xuất nâng major (ví dụ Vitest 5 và
React Router 7); `minimatch` ở frontend báo không có bản sửa trong cây hiện
tại. **Không chạy `npm audit fix`/`npm audit fix --force` và không thay đổi
dependency trong lượt audit này.**

## 4. Giới hạn và bàn giao

- Code M3, OpenAPI M3 và migration chỉ được đọc; không sửa tệp ngoài báo cáo.
- Không sử dụng database thật. `EXPLAIN` cần chạy sau trên database test riêng,
  với roster và discussions có phân bố gần dữ liệu thực tế.
- Chuyển M3-PERF-01/02/03 cho chủ module M3 đánh giá, ưu tiên PERF-01 và
  PERF-02 trước khi lớp học lớn được hỗ trợ.
- Các dependency advisories cần được xử lý bởi người phụ trách dependency
  chung; không tự động áp dụng cập nhật major trong phạm vi audit này.

### Kiểm thử toàn dự án sau audit

- Backend `npm test`: tiến trình không thoát sau 180 giây vì cron M3 tiếp tục
  thử kết nối MySQL cục bộ không chạy; đã dừng lệnh này. Chạy thay
  `node --test --test-force-exit tests/**/*.test.js`: **208 test, 205 đạt,
  3 bỏ qua, 0 lỗi**.
- Frontend `npm test`: **37 test files, 306 test đạt, 0 lỗi**.
