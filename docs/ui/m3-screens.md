# Đặc tả màn hình Frontend M3

> Bước 0 - tài liệu thiết kế, chưa triển khai giao diện. API và tên trường được đối chiếu với
> [`docs/openapi/m3.yaml`](../openapi/m3.yaml); route, slot và shared component theo
> [`docs/frontend-contracts.md`](../frontend-contracts.md).

## Quy ước chung

- Các route M3 cần xác thực và khai báo vai trò theo từng màn hình. Thiếu quyền dùng trang 403 của app.
- Màn hình đọc dữ liệu có đủ `Loading`, `Error` (hiện `message` từ API và cho thử lại), `Empty` và `Success`.
  Form không tải dữ liệu bắt đầu ở `Idle`; khi gửi thì khóa nút và thể hiện trạng thái đang xử lý.
- Nội dung do người dùng nhập hoặc do API trả về render thành văn bản; không dùng `dangerouslySetInnerHTML`.
- Chỉ dùng component đã export từ `frontend/src/shared/components/index.js`, hook API trong shared và Tailwind/shadcn theo
  [`docs/design-system.md`](../design-system.md). Không dùng inline style, mã màu trực tiếp hay CSS riêng của M3.
- Các slot M3 được nạp độc lập: `header-widget.jsx` export component mặc định; `course-tabs.jsx` export mảng tab;
  `lesson-sections.jsx` export mảng phần bài học. M3 không import module M1/M2.
- Mốc tương thích: responsive từ 768px; desktop từ 1280x720; trình duyệt Chrome, Firefox, Edge và Safari hiện đại.
- Các shared component dưới đây đã hiện diện trong scaffold ở thời điểm lập tài liệu. Mỗi bước code vẫn phải xác nhận
  export path qua `frontend/src/shared/components/index.js`.

## 1. Chuông thông báo (`NotificationBell`)

| Thuộc tính | Đặc tả |
|---|---|
| Route / vị trí | Không có route riêng. Slot `header-widget.jsx`, export mặc định `NotificationBell`, hiển thị trên Topbar. |
| Vai trò | Mọi vai trò đã đăng nhập. |
| API | `GET /api/notifications?page=1&limit=20` lấy `NotificationPage`; `PATCH /api/notifications/{notificationId}/read` đánh dấu một thông báo đã đọc. Dùng `id`, `title`, `message`, `type`, `link`, `isRead`, `createdAt`. |
| Ba trạng thái | **Loading:** tải danh sách thông báo. **Error:** hiển thị lỗi và thao tác thử lại. **Empty:** thông báo “Chưa có thông báo”. **Success:** menu thả xuống, phân biệt `isRead`, số chưa đọc trong các mục đã tải. |
| Hành động chính | Mở menu; chọn thông báo chưa đọc để gọi API đánh dấu đã đọc; điều hướng tới `link` nếu có. Làm mới định kỳ theo chu kỳ không quá dày và dừng/giảm tần suất khi tab không hoạt động. |
| Component | Shared: `DropdownMenu`, `Button`, `DataState`, `Skeleton`, `toast`. Riêng M3: `NotificationBell`, mục thông báo nhỏ trong menu. |
| Slot | `header-widget.jsx` của M3. |
| Giới hạn API | `NotificationPage` chỉ có `items`, `page`, `limit`, `total`; không có `unreadCount` hay endpoint unread-count. Vì vậy số trên chuông chỉ có thể đếm các mục đã tải, không thể cam kết là tổng chưa đọc trên toàn bộ hộp thư. Cần backend bổ sung API/field nếu yêu cầu số tổng chính xác. |

## 2. Trang thông báo cá nhân

| Thuộc tính | Đặc tả |
|---|---|
| Route / vị trí | `/notifications`, route M3 có điều hướng `Thông báo`, layout `default`. |
| Vai trò | Mọi vai trò đã đăng nhập. |
| API | `GET /api/notifications?page={page}&limit={limit}`; `PATCH /api/notifications/{notificationId}/read`. |
| Ba trạng thái | **Loading:** skeleton danh sách. **Error:** `DataState` hiển thị lỗi và thao tác thử lại. **Empty:** `DataState` hiển thị trạng thái rỗng khi không có thông báo. **Success:** danh sách phân trang, thời gian, nội dung và trạng thái đã đọc. |
| Hành động chính | Đánh dấu đã đọc; điều hướng theo `link` khi người dùng chọn thông báo. |
| Component | Shared: `PageHeader`, `DataState`, `DataTable` hoặc danh sách thẻ, `Pagination`, `Button`, `StatusBadge` nếu phù hợp. Riêng M3: `NotificationList`, `NotificationItem`. |
| Slot | Route M3 trong `routes/*.jsx`; liên kết nav `Thông báo`. |

## 3. Danh sách đề trắc nghiệm

| Thuộc tính | Đặc tả |
|---|---|
| Route / vị trí | Tab `quizzes` trong `/courses/:courseId`; host tab truyền `{ courseId, course, role, isOwner }`. |
| Vai trò | `GIANG_VIEN`, `SINH_VIEN`; hành động thay đổi theo vai trò và quyền chủ khóa. |
| API | **Chưa có API đọc danh sách đề trong `m3.yaml`.** Đề xuất cần có GET danh sách đề theo khóa, trả `id`, `title`, `durationMinutes`, `openTime`, `closeTime`, `status` và trạng thái attempt của sinh viên. Không tự dùng truy vấn hoặc endpoint chưa được mô tả. |
| Ba trạng thái | Khi API danh sách được bổ sung: **Loading** skeleton; **Error** lỗi server và thử lại; **Empty** chưa có đề; **Success** hiển thị đề, trạng thái và khung giờ. |
| Hành động chính | Giảng viên mở trình tạo đề. Sinh viên vào phòng thi khi đề đang mở; server vẫn là quyết định cuối cùng. |
| Component | Shared: `StatusBadge`, `DataState`, `DataTable`, `Pagination`, `Button`. Riêng M3: `QuizListTab`, `QuizListItem`. |
| Slot | Mục `quizzes` trong `course-tabs.jsx`. |
| Giới hạn API | `m3.yaml` hiện chỉ có create, replace questions, delete question, publish và các endpoint làm bài; chưa có GET quizzes. Cần bổ sung backend/OpenAPI trước khi danh sách này dùng dữ liệu thật. |

## 4. Trình tạo và quản lý đề

| Thuộc tính | Đặc tả |
|---|---|
| Route / vị trí | Trong tab `quizzes` của `/courses/:courseId`; có thể mở form/dialog từ tab. Nếu sau này tách thành route, dùng route thuộc prefix M3 và cập nhật tài liệu route trước khi code. |
| Vai trò | `GIANG_VIEN` là người tạo/chủ khóa theo quyền của khóa; quyền được server xác nhận. |
| API | `POST /api/courses/{courseId}/quizzes` nhận `CreateQuizRequest`: `title`, `description`, `duration_minutes`, `open_time`, `close_time`, `show_score_immediately`, `questions[]`; tạo đề nháp. `PUT /api/quizzes/{quizId}/questions` thay toàn bộ danh sách câu hỏi. `DELETE /api/questions/{questionId}` xóa câu. `POST /api/quizzes/{quizId}/publish` công bố đề. |
| Ba trạng thái | **Idle/Empty:** form mới, chưa có câu hỏi; chưa thể công bố. **Loading:** đang lưu/công bố/xóa; khóa thao tác. **Error:** hiện lỗi server, gắn lỗi xác thực vào trường khi có chi tiết. **Success:** đề nháp đã lưu hoặc đề đã công bố. |
| Hành động chính | Nhập cấu hình; thêm, xóa, sắp xếp câu hỏi; mỗi câu có 2–5 lựa chọn và đúng một đáp án đúng (BR-12, quyết định C.3); chỉ công bố khi có ít nhất một câu. Khi server trả lỗi khóa sửa do đã có lượt thi (EC-07), giữ dữ liệu đang xem và hiện thông báo từ server. |
| Component | Shared: `FormField`, `Input`, `Textarea`, `DateTimeInput`, `Checkbox`, `Button`, `FormDialog`, `ConfirmDialog`, `StatusBadge`, `toast`. Riêng M3: `QuizEditor`, `QuestionEditor`, `OptionEditor`, `QuestionReorderControls`. |
| Slot | Tab `quizzes` trong `course-tabs.jsx`. |
| Giới hạn API | Không có GET chi tiết đề hoặc cập nhật metadata đề. `PUT .../questions` chỉ thay câu hỏi; không thể sửa `title`, thời lượng hoặc thời điểm mở/đóng bằng hợp đồng hiện tại. Xóa câu được khai báo; xóa cả đề chưa có endpoint. Cần làm rõ/bổ sung API trước khi triển khai đầy đủ chức năng sửa. |

## 5. Phòng thi

| Thuộc tính | Đặc tả |
|---|---|
| Route / layout | `/quizzes/:quizId/take`, `layout: 'bare'`, chỉ `SINH_VIEN`. |
| API | `POST /api/quizzes/{quizId}/start`; `PATCH /api/attempts/{attemptId}/save-answer`; `POST /api/attempts/{attemptId}/submit`. Dùng đúng schema `StartAttemptRequest`, `AttemptSession`, `SaveAttemptAnswerRequest`, `SaveAttemptAnswerResponse`, `SubmitAttemptRequest`, `AttemptSubmissionResult`, `AttemptConflict`. |
| Start / resume | Sinh `clientInstanceId` bằng `crypto.randomUUID()` một lần cho tab, lưu trong `sessionStorage` (không dùng `localStorage`). Gửi `clientInstanceId` và `takeOver: false` khi start. `200` trả `attemptId`, `sessionToken`, `startedAt`, `expiresAt`, `remaining_seconds`, `questions`, `savedAnswers`; resume dùng dữ liệu đã lưu từ server. Không ghi nội dung đề vào log, không đọc/lưu `is_correct`. |
| Đồng hồ | Dùng `remaining_seconds` do server trả. Đếm trôi qua bằng `performance.now()` và đồng bộ lại từ phản hồi start/resume hoặc save thành công; không dùng đồng hồ máy để quyết định hạn. Cảnh báo còn 5 phút và 1 phút. Khi về 0, khóa nhận đáp án mới và gọi submit; server vẫn tự thu bài kể cả client mất kết nối. |
| Auto-save / mạng | Sau khi chọn đáp án, debounce ngắn và gửi tuần tự để giữ thứ tự lựa chọn. Gửi `questionId`, `optionId`, `clientInstanceId`, `sessionToken`; cập nhật thời gian theo `remaining_seconds`. Trạng thái rõ ràng: “Đã lưu”, “Đang lưu”, “Lỗi lưu, đang thử lại”. Khi mất mạng giữ đáp án đang chờ trong bộ nhớ và thử lại khi có mạng; cảnh báo trước khi đóng tab nếu còn thay đổi chưa lưu. Không lưu đáp án đúng hoặc nội dung đề vào storage/log. |
| Chiếm phiên | `409 SESSION_ACTIVE_ELSEWHERE`: hỏi “Bài thi đang mở ở nơi khác, chuyển sang tab này?”; chỉ khi người dùng đồng ý mới gọi lại start/resume với `takeOver: true`. Có thể bị từ chối do lượt hết hạn/đã nộp hoặc hết giới hạn takeover; hiển thị `message` của server. `409 SESSION_REPLACED` khi save/submit: khóa giao diện làm bài và thông báo phiên đã bị thay thế; không tiếp tục gửi bằng token cũ. |
| Nộp bài | Nút Nộp bài mở ConfirmDialog, liệt kê số câu chưa làm. Khóa nút khi request đang chạy. Gửi `clientInstanceId` và `sessionToken`. Hết giờ tự gọi cùng API submit. Nộp lặp nhận kết quả đã lưu từ server, không báo lỗi giả. |
| Ba trạng thái | **Loading:** start/resume, khôi phục câu trả lời; không cho tương tác trước khi có session hợp lệ. **Error:** lỗi start/save có nút thử lại hoặc trạng thái mạng; lỗi session bị thay thế khóa phòng thi. **Empty:** API trả mảng câu hỏi rỗng thì không tạo UI làm bài và báo đề không có câu hỏi; đây là trạng thái phòng vệ, không thay thế validation publish. **Success:** câu hỏi và lựa chọn dạng văn bản, thanh điều hướng câu đã/chưa trả lời, đồng hồ và trạng thái tự lưu. |
| Component | Shared: `Button`, `ConfirmDialog`, `DataState`, `toast`. Riêng M3: `QuizRoom`, `QuestionOption` (lựa chọn đơn có semantics truy cập), `CountdownClock`, `QuestionNavigator`, `QuestionCard`, `SaveIndicator`, `SessionTakeoverDialog`. |
| Slot | Route M3 riêng; không ở course tab khi đang thi. |
| Kiểm thử | Fake timers cho resume sau F5 (sessionStorage giữ cùng ID), takeover và `SESSION_REPLACED`, hết giờ tự submit, mất mạng rồi gửi lại; thêm test không lộ đáp án đúng và nút submit chống double-click. |
| Giới hạn API | `SESSION_ACTIVE_ELSEWHERE` và `SESSION_REPLACED` là mã contract; `takeOver` và `clientInstanceId` nằm trong JSON body, không phải header. Server giới hạn takeover và trả `SESSION_TAKEOVER_LIMIT`; UI không tự retry takeover vô hạn. |

## 6. Kết quả và xem lại bài

| Thuộc tính | Đặc tả |
|---|---|
| Route / vị trí | Kết quả sau submit; route đề xuất `/attempts/:attemptId/results`. URL này chưa được khai báo trong frontend contract, cần chốt trước khi thêm route. |
| Vai trò | `SINH_VIEN`, chỉ kết quả của lượt thi của mình. |
| API | `POST /api/attempts/{attemptId}/submit` trả `AttemptSubmissionResult`: `attemptId`, `status` (`SUBMITTED` hoặc `AUTO_SUBMITTED`), `submittedAt`, `score`, `visibleToStudent`. |
| Ba trạng thái | **Loading:** submit/đang lấy kết quả. **Error:** lỗi server, có thể thử lại submit do tính lặp an toàn. **Empty:** chưa có kết quả/lượt thi. **Success:** hiển thị điểm nếu `visibleToStudent` true; nếu false hoặc `score` null, hiển thị “Điểm sẽ được công bố sau” và trạng thái đã nộp. |
| Hành động chính | Xem kết quả sau nộp; nếu submit lặp thì hiển thị kết quả cũ. |
| Component | Shared: `DataState`, `StatusBadge`, `Button`; tiện ích `formatScore` từ shared lib theo frontend contract. Riêng M3: `AttemptResultPanel`. |
| Slot | Route M3 riêng sau phòng thi. |
| Giới hạn API | Chưa có GET kết quả/lượt thi hoặc API xem lại câu trả lời. Sau reload không thể tải lại kết quả từ endpoint hiện có; chức năng “xem lại lượt thi” cần backend/API bổ sung. Không hiển thị đáp án đúng. |

## 7. Bảng tin khóa học

| Thuộc tính | Đặc tả |
|---|---|
| Route / vị trí | Tab `announcements` trong `/courses/:courseId`; label giao diện `Thông báo khóa học`. |
| Vai trò | Thành viên đọc; chủ khóa và `ADMIN` được tạo/xóa (BR-17). |
| API | `GET /api/courses/{courseId}/announcements?page={page}&limit={limit}` trả `AnnouncementPage`; `POST` cùng path nhận `{ title, content }`; `DELETE /api/announcements/{announcementId}`. |
| Ba trạng thái | **Loading:** skeleton danh sách. **Error:** lỗi server và thử lại. **Empty:** chưa có thông báo, người có quyền có hành động tạo. **Success:** danh sách phân trang, mới nhất trước; nội dung hiển thị dạng văn bản. |
| Hành động chính | Thành viên đọc/phân trang. Chủ khóa/Admin tạo và xóa; xóa cần ConfirmDialog. Sau POST, cập nhật danh sách và hiện thông báo thành công. |
| Component | Shared: `DataState`, `PageHeader`, `Pagination`, `FormDialog`, `FormField`, `Input`, `Textarea`, `ConfirmDialog`, `Button`. Riêng M3: `AnnouncementTab`, `AnnouncementCard`, `AnnouncementForm`. |
| Slot | Tab `announcements` trong `course-tabs.jsx`. |

## 8. Thảo luận bài học

| Thuộc tính | Đặc tả |
|---|---|
| Route / vị trí | Phần `discussion` bên dưới nội dung `/lessons/:lessonId`; host section truyền `{ lessonId, courseId, role, isOwner }`. |
| Vai trò | Sinh viên đã ghi danh và chủ khóa; API hiện cho phép role `SINH_VIEN`, `GIANG_VIEN`, còn quyền khóa học được server kiểm tra. |
| API | `GET /api/lessons/{lessonId}/comments?page={page}&limit={limit}` trả `DiscussionPage`; `POST` cùng path tạo chủ đề `{ content }`; `POST /api/comments/{commentId}/replies` tạo trả lời `{ content }`. |
| Ba trạng thái | **Loading:** skeleton chủ đề và trả lời. **Error:** lỗi server và thử lại. **Empty:** trạng thái rỗng khuyến khích đặt câu hỏi đầu tiên. **Success:** danh sách chủ đề phân trang, hiển thị tác giả/thời gian và trả lời. Nội dung render văn bản để chống Stored XSS (BR-18, EC-11). |
| Hành động chính | Tạo bình luận hoặc trả lời chủ đề; sau thành công cập nhật danh sách. |
| Component | Shared: `DataState`, `Pagination`, `FormField`, `Textarea`, `Button`, `Avatar`. Riêng M3: `DiscussionSection`, `DiscussionThread`, `DiscussionComposer`, `ReplyComposer`. |
| Slot | Phần `discussion` trong `lesson-sections.jsx`. |
| Giới hạn API | C6 yêu cầu xóa bình luận theo quyền nhưng `m3.yaml` chưa có DELETE endpoint hoặc quy tắc quyền xóa. Không tự hiển thị/xử lý xóa cho đến khi API được bổ sung. |

## Vấn đề hợp đồng cần xử lý trước các bước code liên quan

| Màn hình | Thiếu hoặc giới hạn trong hợp đồng hiện tại | Tác động |
|---|---|---|
| Chuông thông báo | Không có unread count chính xác. | Chỉ có thể đếm chưa đọc trong tập mục đang tải; cần API/field nếu badge phải là tổng chính xác. |
| Danh sách đề | Không có GET list/detail. | Không thể dựng dữ liệu thật cho tab `quizzes`, cho cả giảng viên và sinh viên. |
| Trình tạo/chỉnh sửa đề | Không có API đọc đề để sửa, cập nhật metadata, hoặc xóa đề. | Tạo đề và sửa/thay câu hỏi tách biệt được; sửa tiêu đề/thời lượng/cửa sổ đề không khả thi đầy đủ. |
| Kết quả/xem lại | Chỉ submit trả kết quả; không có GET result/attempt review. | Hiển thị kết quả ngay sau submit được; mở lại kết quả sau reload và xem lại lượt thi chưa được hỗ trợ. |
| Thảo luận | Không có DELETE bình luận. | Chức năng xóa trong yêu cầu C6 cần backend bổ sung endpoint và quy tắc quyền. |

Các điểm thiếu trên cần người phụ trách backend B/C thống nhất và cập nhật OpenAPI/API trong phạm vi sở hữu trước khi bước frontend tương ứng triển khai. Không thay đổi contract hoặc tự giả định endpoint trong Bước 0.

## Bằng chứng điều kiện nền tảng

Tại thời điểm lập tài liệu, branch hiện tại là `m3-screens`, working tree sạch; `HEAD`, `main` và `origin/main` cùng trỏ tới `e29e435` (PR #32, “feat(m2): Nền tảng dùng chung”). Commit đó có shared components, API client, hooks, test utilities, `frontend/README.md` và `docs/design-system.md`; do đó các thành phần nền tảng dùng cho F0a/F0b hiện diện trong workspace đã cập nhật. Đây là bằng chứng từ refs Git cục bộ; không chạy `fetch` hay thay đổi Git để xác minh trạng thái remote trực tiếp.

## Skills đã đọc

Đã đọc hướng dẫn workspace:

- `.agent/skills/frontend-component-architect/SKILL.md`
- `.agent/skills/design-system-enforcement/SKILL.md`
- `.agent/skills/frontend-api-integration/SKILL.md`
