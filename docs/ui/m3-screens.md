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
| API | `GET /api/courses/{courseId}/quizzes?page={page}&limit=20`. Chủ khóa nhận cả nháp cùng `questionCount` và `hasAttempts`; sinh viên đã ghi danh chỉ nhận đề đã công bố/đóng, `attemptId` của chính mình (null nếu chưa có lượt), `attemptStatus`, `canStart` do server tính, `visibleToStudent` và `score` chỉ khi được phép xem. |
| Ba trạng thái | Khi API danh sách được bổ sung: **Loading** skeleton; **Error** lỗi server và thử lại; **Empty** chưa có đề; **Success** hiển thị đề, trạng thái và khung giờ. |
| Hành động chính | Chủ khóa mở trình tạo đề. Sinh viên có lượt `SUBMITTED`/`AUTO_SUBMITTED` và `attemptId` khác null mở `/attempts/:attemptId/results`; lượt `IN_PROGRESS` tiếp tục tại `/quizzes/:quizId/take`; chưa có lượt (`attemptId` null) chỉ vào thi khi `canStart` là true. Server vẫn là quyết định cuối cùng. |
| Component | Shared: `StatusBadge`, `DataState`, `DataTable`, `Pagination`, `Button`. Riêng M3: `QuizListTab`, `QuizListItem`. |
| Slot | Mục `quizzes` trong `course-tabs.jsx`. |
| Giới hạn API | Phân trang dùng `page` và `limit` (tối đa 100). `attemptId` chỉ định danh lượt của sinh viên hiện tại, không dùng `quizId` thay thế. Sinh viên không nhận câu hỏi trong danh sách; câu hỏi và đáp án chỉ được trả cho chủ khóa qua endpoint chi tiết. |

## 4. Trình tạo và quản lý đề

| Thuộc tính | Đặc tả |
|---|---|
| Route / vị trí | Trong tab `quizzes` của `/courses/:courseId`; có thể mở form/dialog từ tab. Nếu sau này tách thành route, dùng route thuộc prefix M3 và cập nhật tài liệu route trước khi code. |
| Vai trò | `GIANG_VIEN` là người tạo/chủ khóa theo quyền của khóa; quyền được server xác nhận. |
| API | Tạo nháp: `POST /api/courses/{courseId}/quizzes`. Đọc danh sách chủ khóa: `GET /api/courses/{courseId}/quizzes`. Đọc đề để sửa: `GET /api/quizzes/{quizId}` (chủ khóa nhận câu hỏi và cờ `isCorrect`). Cập nhật thông tin: `PATCH /api/quizzes/{quizId}`. Thay toàn bộ câu hỏi: `PUT /api/quizzes/{quizId}/questions`. Công bố: `POST /api/quizzes/{quizId}/publish`. |
| Ba trạng thái | **Idle/Empty:** form mới, chưa có câu hỏi; chưa thể công bố. **Loading:** đang lưu/công bố/xóa; khóa thao tác. **Error:** hiện lỗi server, gắn lỗi xác thực vào trường khi có chi tiết. **Success:** đề nháp đã lưu hoặc đề đã công bố. |
| Hành động chính | Nhập cấu hình; thêm, xóa, sắp xếp câu hỏi và lựa chọn; mỗi câu có 2–5 lựa chọn và đúng một đáp án đúng (BR-12, quyết định C.3). Lưu tạo đề nháp; chỉ công bố khi có ít nhất một câu. Được sửa đề đã công bố nếu chưa có lượt thi; khi đã có lượt thi thì khóa thao tác và hiện thông báo EC-07 từ server. |
| Component | Shared: `FormField`, `Input`, `Textarea`, `DateTimeInput`, `Checkbox`, `Button`, `FormDialog`, `ConfirmDialog`, `StatusBadge`, `toast`. Riêng M3: `QuizEditor`, `QuestionEditor`, `OptionEditor`, `QuestionReorderControls`. |
| Slot | Tab `quizzes` trong `course-tabs.jsx`. |
| Giới hạn API | Cập nhật metadata và thay câu hỏi là hai request riêng; nếu request thay câu hỏi thất bại sau khi metadata đã lưu, giao diện phải báo rõ kết quả một phần để người dùng có thể thử lại. Xóa cả đề không có endpoint. |

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
| Route / vị trí | Kết quả ngay sau submit trong luồng phòng thi; xem lại qua `/attempts/:attemptId/results`. |
| Vai trò | `SINH_VIEN` xem lượt thi của mình; `GIANG_VIEN` xem theo quyền máy chủ. |
| API | `POST /api/attempts/{attemptId}/submit` trả kết quả ngay sau nộp; `GET /api/attempts/{attemptId}/result` tải lại kết quả. |
| Ba trạng thái | **Loading:** đang tải kết quả. **Error:** lỗi tải, có thể thử lại; 403/404 chuyển tới trang ứng dụng tương ứng. **Empty:** chưa có dữ liệu kết quả. **Success:** `IN_PROGRESS` quay về phòng thi; `SUBMITTED`/`AUTO_SUBMITTED` hiển thị trạng thái và thời điểm nộp; chỉ hiện điểm và số câu đúng khi `visibleToStudent` true. Điểm null hiển thị “Chưa có”, không đổi thành 0. |
| Hành động chính | Màn hình sau submit và danh sách đề của sinh viên có lượt đã nộp dẫn tới trang xem lại kết quả bằng `attemptId`. |
| Component | Shared: `EmptyState`, `ErrorState`, `Skeleton`, `StatusBadge`; tiện ích `formatScore`, `formatDateTime`. Riêng M3: `ResultPage`. |
| Slot | Route M3 riêng, layout `default`, không có nav. |
| Giới hạn API | Không có API xem lại câu trả lời; tuyệt đối không hiển thị nội dung câu hỏi hoặc đáp án đúng. |

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
