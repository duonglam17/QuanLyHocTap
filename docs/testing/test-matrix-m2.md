# Ma trận truy vết kiểm thử M2

Ngày khảo sát: 2026-10-29. Nguồn scenario: `docs/PRD.md` (US-07, US-08, US-09,
US-13, US-14); nguồn API: `docs/openapi/m2.yaml`.

**Cách đọc trạng thái:** `Đã có` nghĩa là có test tự động hiện tại kiểm tra được
hành vi nghiệp vụ chính của scenario. `Thiếu` nghĩa là mới có test một phần, còn
thiếu một kết quả chấp nhận hoặc một tầng kiểm thử cần thiết; nội dung thiếu được
ghi ngay trong cột loại test. E2E-2 hiện chưa có spec; các scenario cần E2E được
đánh dấu để bổ sung ở T5. Scenario Outline US-09 được giữ thành một dòng; các
giá trị trong Examples được liệt kê trong tên scenario.

## Scenario và test hiện có

| US | Scenario | BR hoặc EC | Test hiện có (tệp — tên test) | Trạng thái | Loại test cần |
|---|---|---|---|---|---|
| US-07 | Tạo bài tập thành công với hạn nộp hợp lệ | BR-03, BR-07, BR-08; EC-09 | `backend/tests/m2/assignment.test.js` — `US-07 creates an assignment transactionally, sanitizes text, and notifies after commit`; `frontend/src/modules/m2/components/AssignmentTab.test.jsx` — `creates an assignment and refreshes the list after the primary action` | Đã có | Unit, API/role, frontend; integration CSDL và E2E-2 còn cần |
| US-07 | Từ chối tạo bài tập khi hạn nộp đã qua | BR-07, BR-08; EC-12 | `backend/tests/m2/assignment.test.js` — `US-07 rejects a due date that is not in the future`; `frontend/src/modules/m2/components/AssignmentTab.test.jsx` — `connects the server deadline validation error to its field` | Đã có | Unit với clock giả, frontend; integration CSDL và E2E-2 còn cần |
| US-08 | Nộp bài lần đầu trước hạn, ghi nhận thời gian server và trạng thái `SUBMITTED` | BR-05, BR-07, BR-10; EC-03, EC-04, EC-14, EC-20 | `backend/tests/m2/submission.test.js` — `US-08 stores a timely submission with server time and transaction`; `US-08 HTTP endpoint returns 401, 403, and 400 for auth, role, and missing file errors`; `frontend/src/modules/m2/pages/AssignmentSubmissionPage.test.jsx` — `uploads a selected file, locks the submit button, and displays server receipt data` | Đã có | Unit với clock giả, API/role, frontend; integration CSDL và E2E-2 còn cần |
| US-08 | Nhận bài nộp muộn khi cấu hình cho phép, gắn trạng thái và số phút muộn | BR-05, BR-07; EC-12 | `backend/tests/m2/submission.test.js` — `US-08 accepts late work when enabled and records rounded-up late minutes` | Thiếu — chưa có test frontend cho nhãn/thông báo nộp trễ | Unit, frontend, integration API, E2E-2 |
| US-08 | Chặn double-submit; chỉ tạo một bản ghi/transaction khi người dùng bấm liên tiếp | BR-07; EC-04 | `backend/tests/m2/submission.test.js` — `US-08 uses a parameterized unique-key upsert for double-submit protection`; `frontend/src/modules/m2/pages/AssignmentSubmissionPage.test.jsx` — `uploads a selected file, locks the submit button, and displays server receipt data` | Thiếu — mới kiểm tra câu SQL upsert và khóa nút UI, chưa kiểm tra request đồng thời với CSDL | Unit, integration API/CSDL, frontend, E2E-2 |
| US-08 | Nộp lại bài trước hạn, cập nhật bản nộp mới nhất và xử lý tệp cũ | BR-07, BR-10; EC-09, EC-19, EC-20 | `backend/tests/m2/submission.test.js` — `US-08 resubmits in place and removes the previous file only after commit`; `frontend/src/modules/m2/pages/AssignmentSubmissionPage.test.jsx` — `uploads a selected file, locks the submit button, and displays server receipt data` (chỉ xác nhận nút nộp lại khả dụng) | Thiếu — chưa kiểm tra thao tác nộp lại và receipt mới trên UI | Unit, frontend, integration API/CSDL, E2E-2 |
| US-09 | Giảng viên chấm điểm hợp lệ, lưu nhận xét, chuyển trạng thái và sinh viên xem được kết quả | BR-03, BR-08, BR-09, BR-11, BR-18 | `backend/tests/m2/grade.test.js` — `US-09 grades a submission transactionally, sanitizes feedback, and notifies after commit`; `frontend/src/modules/m2/pages/SubmissionGradingPage.test.jsx` — `validates score increments in the form and saves a grade`; `frontend/src/modules/m2/pages/MyGradesPage.test.jsx` — `shows published quiz scores and preserves missing scores as "Chưa có"` | Đã có | Unit, frontend; integration API/CSDL và E2E-2 còn cần |
| US-09 | Scenario Outline — từ chối điểm ngoài khoảng/sai định dạng (`-1`, `10.5`, `abc`) | BR-08; EC-16 | `backend/tests/m2/grade.test.js` — `US-09 validates the 0 to 10 range and 0.25 score increments` (dùng `-0.25`, `10.25`, `8.1`, `abc`); `frontend/src/modules/m2/pages/SubmissionGradingPage.test.jsx` — `validates score increments in the form and saves a grade` | Đã có — cùng nhánh biên được kiểm tra với giá trị tương đương, nhưng chưa dùng chính xác `-1` và `10.5` như Examples | Unit, frontend; integration API 422 và E2E-2 còn cần |
| US-09 | Giảng viên không sở hữu khóa học không được chấm bài (IDOR) | BR-03, BR-09, BR-11; EC-01 | `backend/tests/m2/grade.test.js` — `US-09 rejects a grader who does not own the submission course`; `US-09 rejects submission downloads before exposing the file to a non-owner`; `US-09 HTTP endpoint returns 401, 403, 404, and 422 for grading requests`; `frontend/src/modules/m2/pages/SubmissionGradingPage.test.jsx` — `shows the server authorization error and retry action` | Đã có | Unit, API role/authorization, frontend; integration CSDL và E2E-2 còn cần |
| US-13 | Sinh viên xem điểm bài tập và bài thi đã công bố; điểm chưa có vẫn là null | BR-05, BR-09 | `backend/tests/m2/studentGradebook.test.js` — `US-13 returns personal assignment and quiz grades and hides unpublished quizzes`; `US-13 repository joins only the authenticated student submissions and preserves null scores`; `frontend/src/modules/m2/pages/MyGradesPage.test.jsx` — `shows published quiz scores and preserves missing scores as "Chưa có"` | Đã có | Unit, frontend; integration API/CSDL và E2E-2 còn cần |
| US-13 | Sinh viên không xem được điểm của sinh viên khác (IDOR) | BR-09; EC-01 | `backend/tests/m2/studentGradebook.test.js` — `US-13 endpoint derives identity from JWT and ignores any client student_id`; `US-13 denies access when the authenticated student is not enrolled`; `US-13 rejects non-student roles on the personal gradebook endpoint` | Đã có — danh tính luôn lấy từ JWT; PRD mô tả 403 khi sửa student_id, còn API hiện bỏ qua tham số lạ và chỉ trả điểm của người đăng nhập | Unit, integration API identity/authorization, E2E-2 còn cần |
| US-14 | Xem bảng điểm lớp, phân trang 20 sinh viên | BR-03, BR-09; EC-21 | `backend/tests/m2/classGradebook.test.js` — `US-14 returns a 20-student page with batched assignment and course quiz scores`; `US-14 repository uses one parameterized tuple-IN query for the page scores`; `frontend/src/modules/m2/pages/ClassGradebookPage.test.jsx` — `paginates using 20 students per page` | Đã có | Unit, frontend; integration API/CSDL và E2E-2 còn cần |
| US-14 | Xuất CSV đầy đủ, có BOM UTF-8 và chống CSV Injection | BR-16; EC-17, EC-21 | `backend/tests/m2/classGradebook.test.js` — `US-14 escapes CSV formula prefixes and quotes cells`; `US-14 streams CSV with UTF-8 BOM, formula escaping, and the full roster`; `frontend/src/modules/m2/pages/ClassGradebookPage.test.jsx` — `exports CSV and disables the button while the file is being created` | Đã có | Unit, frontend; integration API/CSDL và E2E-2 còn cần |

## Tổng hợp

- Tổng số Scenario/Scenario Outline Gherkin: **13**.
- Đã có test cho hành vi chính: **10**.
- Thiếu hoặc mới kiểm tra một phần: **3** (US-08 nộp muộn ở UI; double-submit với API/CSDL đồng thời; nộp lại từ UI).
- Spec E2E-2: **chưa có**. Hạ tầng hiện có chỉ chứa `e2e/specs/smoke.spec.js`; hành trình M2 cần bổ sung ở T5 sau khi điều kiện merge/pull hạ tầng được đáp ứng.
- Test backend hiện chủ yếu là unit với Port/repository giả và Supertest với middleware/DB auth giả. Supertest gọi router/controller thật cho assignment, submission, chấm điểm, tải tệp và bảng điểm, nhưng không thay thế integration với MySQL thật.
- `backend/tests/m2/assessmentUsage.db.test.js` kiểm tra MySQL bằng bảng tạm và chỉ chạy khi đặt `M2_TEST_DB_NAME` trỏ tới database riêng có tên kết thúc `_test`; mặc định skip để không truy cập DB phát triển. Để chạy: tạo trước database riêng (ví dụ `CREATE DATABASE lms_m2_test CHARACTER SET utf8mb4;`), cấu hình `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` theo MySQL test, rồi trong PowerShell chạy `$env:M2_TEST_DB_NAME='lms_m2_test'; node --test tests/m2/assessmentUsage.db.test.js`. MySQL hiện không sẵn sàng trên máy này nên test integration CSDL bị skip; chưa có integration test CSDL thật cho các luồng scenario trên.
- Test frontend M2 hiện dùng API mock; chưa có test trực tiếp cho các phản hồi 401, 409 hoặc 429 ở UI. Bổ sung T2 đã kiểm tra status HTTP 400, 401, 403, 404, 409, 422, 413 và 429 ở nơi liên quan; xem tên test trong bảng. Hạn nộp dùng `clock.now()` giả lập ở assignment/submission unit tests; đồng hồ giờ thi không thuộc module M2 (M3).

## BR/EC chưa được kiểm chứng đầy đủ trong luồng M2

### Business Rules

- Không có BR nào trong danh sách khảo sát (`BR-03`, `BR-05`, `BR-07`–`BR-11`, `BR-16`, `BR-18`) hoàn toàn không có test trong toàn bộ test hiện có. Một số quy tắc dùng hạ tầng chung đã có test ở module khác; ví dụ `backend/tests/m1/common.test.js` kiểm tra magic bytes, tên UUID và tên tệp tiếng Việt. M2 hiện chỉ kiểm tra cấu hình gọi `storage.saveUpload` trong fake storage, chưa có integration test xác nhận hợp đồng upload của M2 với storage thật.

### Edge Cases

- **EC-14 — thiếu kiểm thử gắn với luồng nộp bài M2:** shared API có test làm mới phiên sau 401 (`frontend/src/shared/api/client.test.js` — `refreshes a session once after a protected request returns 401`), nhưng chưa có test chứng minh tệp đã chọn và hành trình nộp bài được bảo toàn khi phiên hết hạn.
- **EC-18 — thiếu kiểm thử hiệu năng:** chưa có test tải đồng thời/tệp lớn cho download hoặc upload bài tập. Test hiện có kiểm tra giới hạn 20 MiB và stream một tệp nhỏ, không đo tình huống nhiều sinh viên tải tệp lớn cùng lúc.
- **EC-06 — không áp dụng trực tiếp cho scenario M2:** quy tắc lệch đồng hồ áp dụng cho giờ làm bài thi; US-14 là truy vấn bảng điểm, không quyết định hạn nộp hoặc giờ thi. Các kiểm thử thời gian thi thuộc M3.

Các EC còn lại trong danh sách khảo sát có test liên quan: EC-01/03/20 tại test quyền truy cập và storage dùng chung; EC-04/12 ở kiểm thử nộp bài; EC-09/19 ở kiểm thử lưu trữ và dọn tệp khi transaction lỗi; EC-16 ở kiểm tra điểm; EC-17/21 ở kiểm tra CSV và truy vấn bảng điểm.
