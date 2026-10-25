# Đặc tả màn hình Frontend M2

> Bước M2.0 - tài liệu thiết kế, chưa triển khai giao diện. Yêu cầu và quy tắc nghiệp vụ theo
> [`docs/PRD.md`](../PRD.md); chữ ký API theo [`docs/openapi/m2.yaml`](../openapi/m2.yaml);
> route, slot và component dùng chung theo [`docs/frontend-contracts.md`](../frontend-contracts.md).

## Quy ước chung

- Màn hình khóa học dùng layout `default`, xác thực và quyền truy cập theo vai trò. Không đủ quyền dùng trang 403
  của app; API vẫn phải kiểm tra quyền sở hữu/ghi danh, không dựa riêng vào ẩn nút.
- Tab khóa học đóng góp qua `course-tabs.jsx`, dùng id `assignments` và `grades` theo frontend contract. Tab được
  hiển thị trong `/courses/:courseId`; không tạo route module riêng cho tab.
- Các URL chi tiết bên dưới là route đề xuất cho màn hình M2. Route `/me/grades` và hai tab khóa học là các điểm
  truy cập bổ sung tới bảng điểm cá nhân.
- Màn hình tải dữ liệu có đủ `Loading`, `Error` (hiện nguyên message từ API, có Thử lại), `Empty` và `Success`.
  Form không tải dữ liệu bắt đầu ở `Idle`; khi gửi phải hiển thị trạng thái xử lý và khóa nút.
- Lỗi validation `422` gắn vào trường khi API trả chi tiết trường; lỗi khác giữ nguyên message server. Điểm null
  hiển thị “Chưa có”. Thời hạn và trạng thái trễ lấy theo dữ liệu/thời gian server, không quyết định bằng đồng hồ máy.
- Dùng shared component đã export, Tailwind và token thiết kế; không inline style, mã màu hex, CSS riêng hay
  `dangerouslySetInnerHTML`. Nội dung tiếng Việt; responsive từ 768px.
- Trạng thái khóa học `ARCHIVED` chỉ cho phép thao tác đọc; không tạo/sửa bài tập, nộp bài hoặc chấm điểm. Việc tải
  tệp và xuất CSV là thao tác đọc, phụ thuộc quyền và phản hồi API.
- **Giới hạn hợp đồng API:** `docs/openapi/m2.yaml` hiện đặc tả danh sách/tạo/cập nhật bài tập và điểm cá nhân.
  Các API submission, chấm bài và bảng điểm lớp dưới đây vẫn cần được đặc tả trước khi tích hợp. Những endpoint cũ
  trong `docs/design-review.md` không có đủ schema/response để thay thế hợp đồng này.

## 1. Bài tập trong khóa học (US-07)

| Thuộc tính | Đặc tả |
|---|---|
| Route / vị trí | Tab `assignments` trong `/courses/:courseId`; label “Bài tập”. |
| Vai trò | Giảng viên chủ khóa: xem, tạo, sửa bài tập. Sinh viên đã ghi danh: xem danh sách và trạng thái nộp. Thành viên khác không được truy cập. Khóa `ARCHIVED`: chỉ đọc. |
| API | `GET /api/courses/{courseId}/assignments` trả `{ success, count, data }`; sinh viên đã xác thực nhận `submission_status` (`SUBMITTED`, `SUBMITTED_LATE`, `GRADED` hoặc `null`). `POST` cùng path nhận `title`, `due_date` (date-time), `description`, `max_score` (mặc định 10, tối đa 10) và `allow_late_submission` (mặc định false). `PATCH /api/assignments/{id}` nhận các trường cần cập nhật. Cả hai thao tác ghi chỉ dành cho chủ khóa còn quyền ghi; lỗi validation trả 422 với chi tiết trường. Danh sách hiện không phân trang. |
| Trạng thái | **Loading:** skeleton danh sách. **Error:** hiện lỗi server và Thử lại. **Empty:** giải thích chưa có bài tập; giảng viên được gợi ý tạo bài đầu tiên, sinh viên chỉ xem thông tin rỗng. **Success:** danh sách tiêu đề, hạn nộp, cấu hình nộp trễ và `StatusBadge` trạng thái bài nộp cho sinh viên. |
| Hành động chính | Giảng viên tạo/sửa với tiêu đề, mô tả, hạn nộp ngày giờ, cho phép nộp trễ và điểm tối đa 10; hạn nộp quá khứ phải hiện lỗi server. Lỗi `422` gắn đúng trường. Sinh viên mở bài tập để xem/nộp bài. Không hiện thao tác sửa khi khóa đã lưu trữ. |
| Component | Shared: `DataState`, `PageHeader`, `EmptyState`, `ErrorState`, `FormDialog`, `FormField`, `Input`, `Textarea`, `DateTimeInput`, `Checkbox`, `Button`, `StatusBadge`, `Pagination` nếu API phân trang. M2: danh sách và form bài tập. |
| Slot | `course-tabs.jsx`, id `assignments`, roles `GIANG_VIEN`, `SINH_VIEN`. |

## 2. Chi tiết bài tập và nộp bài (US-08)

| Thuộc tính | Đặc tả |
|---|---|
| Route / vị trí | `/courses/:courseId/assignments/:assignmentId`, layout `default`. |
| Vai trò | Sinh viên đã ghi danh. Giảng viên chủ khóa có thể xem thông tin bài tập; chức năng nộp chỉ dành cho sinh viên. |
| API | Cần API lấy chi tiết bài tập, lấy trạng thái/bài nộp hiện tại và nộp hoặc cập nhật bài nộp. Chưa có các endpoint này trong `docs/openapi/m2.yaml`. API phải trả thông tin deadline/cấu hình `allow_late` và thời điểm nộp do server ghi nhận. |
| Trạng thái | **Loading:** skeleton chi tiết, hạn nộp và vùng nộp tệp. **Error:** hiện nguyên message server, gồm các lỗi `400`, `403`, `413`, `429`, và cho phép thử lại khi phù hợp. **Empty:** chưa có bài nộp; hiển thị hướng dẫn chọn tệp. **Success:** nội dung bài tập, hạn nộp, trạng thái hiện tại, thời điểm server ghi nhận và kết quả nộp. |
| Hành động chính | Chọn tệp bằng `FileInput` (giới hạn BR-07 tối đa 20 MB; loại tệp được phép cần được xác nhận trong hợp đồng API), xem cảnh báo nộp trễ theo deadline/config server và gửi. Khóa nút ngay khi gửi bắt đầu (EC-04). Nộp lại theo C.2: cập nhật bài nộp hiện có và tăng `submission_count`; chỉ cho nộp trễ nếu cấu hình cho phép. Khóa `ARCHIVED`: chỉ xem, không gửi/nộp lại. |
| Component | Shared: `DataState`, `FileInput`, `StatusBadge`, `Button`, `Skeleton`, `ErrorState`, `EmptyState`, `toast`. M2: `AssignmentDetail`, `SubmissionResult`. |
| Slot | Route M2 riêng; không phải slot tab. |

## 3. Danh sách bài nộp và chấm điểm (US-09)

| Thuộc tính | Đặc tả |
|---|---|
| Route / vị trí | `/courses/:courseId/assignments/:assignmentId/submissions` mở bảng bài nộp; chọn một dòng mở vùng chấm tại `/courses/:courseId/assignments/:assignmentId/submissions/:submissionId`, layout `default`. |
| Vai trò | Chỉ giảng viên chủ khóa. Sinh viên không có quyền truy cập màn hình chấm; giảng viên không sở hữu khóa nhận 403. |
| API | Cần API lấy danh sách bài nộp phân trang, tải tệp nộp có xác thực và lưu điểm/nhận xét. Chưa có các endpoint này trong `docs/openapi/m2.yaml`; tải tệp phải dùng `api.download`, không gắn token vào URL. |
| Trạng thái | **Loading:** skeleton bảng và form. **Error:** hiện message server và Thử lại; lỗi `403` thông báo không có quyền sở hữu khóa. **Empty:** chưa có bài nộp, không hiện form chấm. **Success:** bảng phân trang, tệp của bài nộp được chọn và form chấm; bài đã chấm có trạng thái `GRADED`. |
| Hành động chính | Tải tệp; nhập điểm 0–10 theo bước 0.25 và nhận xét; lưu điểm; chọn bài trước/sau trong danh sách đã tải/phân trang. Validate điểm phía client, đồng thời hiển thị lỗi validation từ server. Khóa `ARCHIVED`: chỉ xem/tải tệp nếu API cho phép, không lưu điểm. |
| Component | Shared: `DataState`, `DataTable`, `Pagination`, `FormField`, `Input`, `Textarea`, `Button`, `StatusBadge`, `api.download`, `toast`. M2: `SubmissionGradingPanel`. |
| Slot | Route M2 riêng; không phải slot tab. |

## 4. Điểm của tôi (US-13)

| Thuộc tính | Đặc tả |
|---|---|
| Route / vị trí | Route `/me/grades` cho sinh viên; đồng thời đóng góp tab `grades` trong `/courses/:courseId`, label “Điểm”. Route cá nhân chọn khóa học để lấy `courseId`; tab dùng `courseId` của khóa hiện tại. |
| Vai trò | Sinh viên đã ghi danh khóa học. Không nhận `student_id` từ client; danh tính lấy từ bearer token. |
| API | Route `/me/grades` cần chọn khóa từ `GET /api/courses` (M1). Lấy điểm bằng `GET /api/m2-assessment/courses/{courseId}/my-grades` (`getMyCourseGrades`). Response `data` gồm `course_id`, `assignments[]`, `quizzes[]`; mỗi item có `type`, `id`, `title`, `score`, và có thể có `maxScore`, `feedback`, `status`, `visibleToStudent`. Điểm bài tập chưa nộp/chưa chấm có `score: null`; điểm quiz bị ẩn không có trong response. Endpoint không phân trang. |
| Trạng thái | **Loading:** skeleton bảng điểm của khóa đang chọn. **Error:** hiện message API; xử lý `403` khi không phải sinh viên đã ghi danh. **Empty:** chưa có đầu điểm/điểm để hiển thị, giải thích rõ. **Success:** nhóm bài tập và trắc nghiệm; điểm null hiện “Chưa có”, điểm quiz chưa được công bố không giả thành 0 hay tự tạo dòng bị ẩn. |
| Hành động chính | Chọn/mở khóa học và xem điểm các bài tập, bài trắc nghiệm cùng điểm tối đa/nhận xét nếu API trả về. |
| Component | Shared: `DataState`, `DataTable`, `StatusBadge`, `formatScore`, `EmptyState`, `ErrorState`. M2: `StudentGradebook`. |
| Slot | `course-tabs.jsx`, id `grades`, roles `SINH_VIEN`; ngoài ra có route `/me/grades`. |

## 5. Bảng điểm lớp (US-14, Should)

| Thuộc tính | Đặc tả |
|---|---|
| Route / vị trí | `/courses/:courseId/gradebook`, layout `default`; có thể liên kết từ trang khóa học của giảng viên. |
| Vai trò | Giảng viên chủ khóa. Thành viên không phải chủ khóa không được xem hoặc xuất bảng điểm. |
| API | Cần API lấy bảng điểm tổng hợp theo khóa, phân trang danh sách sinh viên (20 mỗi trang), và API tạo/tải CSV có xác thực. Chưa có các endpoint này trong `docs/openapi/m2.yaml`; cần đặc tả schema, phân trang, quyền, phản hồi/trạng thái tạo tệp và quy tắc lỗi trước khi tích hợp. |
| Trạng thái | **Loading:** skeleton lưới điểm và phân trang; khi xuất hiển thị trạng thái đang tạo/tải tệp. **Error:** hiện message server và Thử lại; lỗi quyền không cho xem/xuất. **Empty:** lớp chưa có sinh viên hoặc chưa có thành phần điểm, giải thích rõ. **Success:** bảng sinh viên × thành phần điểm, 20 sinh viên mỗi trang; ô điểm chưa có không hiển thị thành 0. |
| Hành động chính | Chuyển trang; xuất CSV toàn khóa qua `api.download`. CSV phải an toàn trước CSV Injection và có UTF-8 BOM theo BR-16. Khóa `ARCHIVED`: chỉ xem/xuất, không sửa dữ liệu điểm. |
| Component | Shared: `DataState`, `DataTable`, `Pagination`, `Button`, `formatScore`, `api.download`, `toast`. M2: `CourseGradebook`. |
| Slot | Route M2 riêng; không phải slot tab. |

## Khoảng trống cần giải quyết trước các bước triển khai

- Đã có API danh sách/tạo/cập nhật bài tập và điểm cá nhân trong `docs/openapi/m2.yaml`. Cần bổ sung hợp đồng cho
  upload và xem bài nộp, tải tệp bài nộp, lưu điểm, bảng điểm lớp và xuất CSV trước khi nối các màn hình tương ứng.
- Đặc tả API cần thống nhất tên trường, enum trạng thái, kiểu phân trang, MIME/đuôi tệp được phép, deadline theo server,
  response lỗi và cách biểu diễn việc tạo CSV đang xử lý. Tài liệu này không tự sửa hoặc thay thế OpenAPI.
- Các màn hình sử dụng shared component nêu theo frontend contract; trước khi code cần xác nhận export thực tế từ shared.
