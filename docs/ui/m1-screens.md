# Đặc tả màn hình Frontend M1

> Bước 0 - tài liệu thiết kế, chưa triển khai giao diện. API và tên trường bên dưới lấy từ
> [`docs/openapi/m1.yaml`](../openapi/m1.yaml); quy ước route, shared component và slot lấy từ
> [`docs/frontend-contracts.md`](../frontend-contracts.md).

## Quy ước dùng chung

- Mọi trang được bảo vệ bởi xác thực và quyền route phù hợp; điều hướng không đủ quyền theo cơ chế 403 của app.
- Mọi trang tải dữ liệu phải có `Loading`, `Error` (hiển thị message từ server, có Thử lại), `Empty` và `Success`.
  Với form không tải danh sách, trạng thái ban đầu trống là `Idle`; khi gửi hiển thị loading và khóa nút.
- Lỗi 422 gắn với trường tương ứng nếu API trả đủ chi tiết; lỗi khác hiển thị nguyên `message` của API. Không tự suy diễn
  nội dung hoặc phân loại lỗi ngoài dữ liệu API.
- Chỉ dùng component Tailwind/shadcn và semantic design token do shared cung cấp. Không dùng inline style, mã màu hex hay
  render HTML người dùng. Thiết kế cần responsive từ 768px, desktop từ 1280x720 và dùng được trên Chrome, Firefox, Edge,
  Safari hiện đại.
- Component shared ghi ở đây theo mục 8 của frontend contract; trước khi triển khai cần xác nhận B đã merge F0a/F0b và
  các export thực tế. Hiện thư mục shared trong workspace mới có Button, Input, PageTemplate, LoadingState, ErrorState,
  EmptyState và StatusMessage; nhiều component trong hợp đồng vẫn chưa thấy trong scaffold.
- `docs/design-system.md` và `frontend/README.md` chưa có trong workspace tại thời điểm lập tài liệu. Không giả định token,
  hướng dẫn chạy hoặc quy ước ngoài những gì frontend contract mô tả.

## 1. Đăng nhập

| Thuộc tính | Đặc tả |
|---|---|
| Route / layout | `/login`, public, layout `bare`. Sau đăng nhập quay về trang yêu cầu ban đầu nếu có; nếu không chuyển tới trang chủ phù hợp vai trò. |
| Vai trò | Admin, Giảng viên, Sinh viên. |
| API | `POST /api/auth/login` với `{ username, password }`; response `AuthSession` gồm `accessToken`, `refreshToken`, `user.id`, `user.role`, `user.must_change_password`. Việc lưu token và đổi mới phiên thuộc `useAuth()`, không xử lý trong module. |
| Trạng thái | **Idle/Empty:** form trống, chưa có lỗi. **Loading:** đang đăng nhập, nút bị khóa và có Spinner. **Error:** hiện message server cho thông tin sai (`401`), tài khoản khóa (`403`, gồm LOCKED/TEMPORARY_LOCKED) và rate limit (`429`); lỗi thiếu trường (`400`) hiển thị tại form. |
| Hành động chính | Nhập tên đăng nhập hoặc email và mật khẩu; kiểm tra trường bắt buộc; gửi qua `useAuth().login`. |
| Component | Shared: FormField, Input, Label, Button, Spinner, Toast. M1: `LoginForm` và xử lý điều hướng sau login. |
| Slot | Không có. |

## 2. Danh sách khóa học

| Thuộc tính | Đặc tả |
|---|---|
| Route / layout | `/courses`, layout `default`. |
| Vai trò | Admin, Giảng viên, Sinh viên. API trả khóa theo quyền người gọi: Admin xem danh sách theo API, Giảng viên khóa mình sở hữu, Sinh viên khóa đã ghi danh. |
| API | `GET /api/courses`; response `{ items: Course[] }`. Trường Course theo OpenAPI: `id`, `code`, `title`, `description`, `semester`, `ownerId`, `enrollment_key` (nếu được phép trả), `status` (`DRAFT`, `PUBLISHED`, `ARCHIVED`). |
| Trạng thái | **Loading:** skeleton danh sách. **Error:** ErrorState/Thử lại và message server. **Empty:** EmptyState giải thích chưa có khóa, kèm hành động theo vai trò. **Success:** danh sách khóa với StatusBadge. |
| Hành động chính | Mở chi tiết; Giảng viên bắt đầu tạo/quản lý khóa; Sinh viên mở hộp thoại ghi danh; Admin mở khóa được API trả về. Khóa ARCHIVED được đánh dấu chỉ đọc. |
| Component | Shared: PageHeader, DataState, DataTable hoặc card layout, StatusBadge `{ type: 'course', value: status }`, Button, EmptyState, ErrorState, Skeleton, FormDialog. M1: `CourseList`/`CourseCard`. |
| Slot | Điểm gắn tab thuộc trang chi tiết khóa (mục 3); M1 đăng ký `lessons` và `schedule` ở các bước A4/A5. |

## 3. Chi tiết khóa học

| Thuộc tính | Đặc tả |
|---|---|
| Route / layout | `/courses/:courseId`, layout `default`. |
| Vai trò | Admin, Giảng viên là chủ khóa, Sinh viên đã ghi danh theo quyền xem chi tiết API. |
| API | `GET /api/courses/{courseId}`; response `{ course: Course }`. Dùng `course.ownerId` để xác định `isOwner`; không tin giá trị role/owner do client cung cấp. |
| Trạng thái | **Loading:** skeleton phần tiêu đề và tab. **Error:** ErrorState/Thử lại (bao gồm 403/404 với message server). **Empty:** không áp dụng riêng cho một khóa đơn, hiển thị not-found/error state; tab con vẫn có Empty riêng. **Success:** thông tin khóa và tab có dữ liệu. |
| Hành động chính | Xem thông tin khóa và chuyển tab; khóa ARCHIVED chỉ đọc. |
| Component | Shared: PageHeader, Tabs trang, StatusBadge khóa học, DataState/Skeleton/ErrorState. M1: `CourseDetailPage` truyền `{ courseId, course, role, isOwner }` cho các tab slot. |
| Slot | `getCourseTabs()` theo frontend contract; lọc theo `roles`. M1 cung cấp tab `lessons`, `schedule`; không import tab của M2/M3. |

## 4. Quản lý khóa học

| Thuộc tính | Đặc tả |
|---|---|
| Route / layout | Hành động tạo bắt đầu từ `/courses`; chỉnh sửa/xuất bản/lưu trữ từ `/courses/:courseId`. Chưa có route riêng bắt buộc trong contract. |
| Vai trò | Giảng viên; các thao tác mutation chỉ dành cho chủ khóa theo backend. Admin có quyền xem/lưu trữ theo API nhưng không được mặc định quyền sửa. |
| API | Tạo `POST /api/courses` với `code`, `title`, `description?`, `semester`, `enrollmentKey?`; sửa `PATCH /api/courses/{courseId}` với ít nhất một trường; xuất bản `PATCH /api/courses/{courseId}/publish`; lưu trữ `PATCH /api/courses/{courseId}/archive`. `DELETE /api/courses/{courseId}` là API xóa mềm khóa rỗng hoặc lưu trữ khóa có dữ liệu; không có xóa cứng. |
| Trạng thái | **Loading:** loading form/mutation, khóa nút gửi. **Error:** lỗi server (đặc biệt 403/409/422) hiển thị đúng message; lỗi validation gắn trường. **Empty:** form tạo mới ở trạng thái rỗng/Idle; không có chi tiết khóa thì không hiển thị action edit. **Success:** cập nhật khóa và StatusBadge; báo thành công bằng Toast. |
| Hành động chính | Tạo khóa DRAFT, sửa thông tin, xuất bản, lưu trữ bằng ConfirmDialog; xem/sao chép `enrollment_key` nếu API trả về. Dữ liệu có phát sinh không bao giờ cho phép xóa cứng; ưu tiên action Lưu trữ và để backend quyết định an toàn. |
| Component | Shared: FormDialog, FormField, Input, Textarea, Button, ConfirmDialog, StatusBadge, Toast, Spinner. M1: `CourseForm` và action toolbar. |
| Slot | Nằm trong trang chi tiết khóa và không thay đổi hợp đồng slot. |

## 5. Ghi danh bằng mã

| Thuộc tính | Đặc tả |
|---|---|
| Route / layout | Hộp thoại từ `/courses`, không cần route độc lập đã chốt. |
| Vai trò | Sinh viên. |
| API | `POST /api/courses/enroll` với `{ enrollment_key }`; thành công `201`. API phân biệt chữ hoa/thường, chỉ khóa PUBLISHED; rate limit trả `429`. |
| Trạng thái | **Idle/Empty:** ô nhập mã trống. **Loading:** khóa nút tham gia. **Error:** hiện message server cho `400`, `403`, `404` (mã sai/khóa chưa xuất bản), `409` (đã ghi danh), `429`. **Success:** Toast và refetch danh sách khóa học. |
| Hành động chính | Nhập mã 6–8 ký tự chữ/số, gửi ghi danh, đóng hộp thoại sau thành công. |
| Component | Shared: FormDialog, FormField, Input, Button, Spinner, Toast. M1: `EnrollmentDialog`. |
| Slot | Không có. |

## 6. Quản lý người dùng

| Thuộc tính | Đặc tả |
|---|---|
| Route / layout | `/admin/users`, layout `default`. |
| Vai trò | ADMIN. |
| API | `GET /api/users?search&role&status&page&limit` trả `{ items, total, page, limit }`; `POST /api/users` với `{ fullName, username, email, role }`; `PATCH /api/users/{userId}/status` với `{ status: ACTIVE|LOCKED }`; `PATCH /api/users/{userId}/role` với `{ role }`; `DELETE /api/users/{userId}` để xóa mềm. |
| Trạng thái | **Loading:** skeleton bảng/tìm kiếm. **Error:** message server và Thử lại. **Empty:** không có người dùng phù hợp bộ lọc, có thể xóa bộ lọc/tạo tài khoản. **Success:** bảng phân trang; StatusBadge `{ type: 'account', value: status }`. Mutation có loading/error riêng và khóa nút gửi. |
| Hành động chính | Tìm kiếm, lọc role/status, đổi trang; tạo tài khoản; khóa/mở khóa, đổi vai trò và xóa mềm sau ConfirmDialog. Vô hiệu hóa tự khóa khi người dùng là tài khoản hiện tại, đồng thời vẫn hiển thị lỗi server nếu API từ chối. Hiển thị mật khẩu ban đầu trả về từ POST đúng một lần, có nút sao chép. |
| Component | Shared: DataTable, SearchInput, Select, Pagination, StatusBadge, FormDialog, FormField, ConfirmDialog, Button, Toast, EmptyState, ErrorState, Skeleton. M1: cấu hình cột và `UserForm`. |
| Slot | Không có. |

## 7. Bài giảng và tài liệu

| Thuộc tính | Đặc tả |
|---|---|
| Route / layout | Tab `Bài giảng` trong `/courses/:courseId`; trang bài học `/lessons/:lessonId` dùng layout `default`. |
| Vai trò | Chủ khóa/Giảng viên tạo bài học và upload tài liệu; Sinh viên đã ghi danh xem bài và tải tài liệu. Khóa ARCHIVED chỉ đọc. |
| API | `GET /api/courses/{courseId}/lessons`; `POST /api/courses/{courseId}/lessons` với `{ title, content?, orderIndex? }`; `GET /api/lessons/{lessonId}/materials`; `POST /api/lessons/{lessonId}/materials` multipart `{ title, file }`; download qua `GET /api/courses/{courseId}/materials/{materialId}/download` với xác thực qua api client. File được giới hạn 50 MiB và allowlist `.pdf`, `.docx`, `.pptx`, `.zip`, `.rar`. |
| Trạng thái | **Loading:** skeleton danh sách bài/tài liệu hoặc tiến trình upload. **Error:** ErrorState/Thử lại; giữ message API, không mất form khi thất bại. **Empty:** EmptyState; giảng viên có action tạo bài, sinh viên chỉ thấy nội dung rỗng. **Success:** bài theo thứ tự, metadata tài liệu và nút tải. |
| Hành động chính | Giảng viên tạo bài và upload tài liệu bằng FileInput; sinh viên tải file bằng `api.download` (không đặt token trong URL). Không cung cấp nút sửa/xóa bài cho tới khi API được đặc tả. |
| Component | Shared: Tabs trang, DataState, EmptyState, ErrorState, Skeleton, FormDialog, FormField, Input, Textarea, Button, FileInput, Pagination nếu danh sách cần phân trang, Toast. M1: `LessonList`, `LessonForm`, `MaterialList`, `MaterialUploadForm`, trang nội dung bài học. |
| Slot | Tab `lessons` đăng ký qua `course-tabs.jsx`. Trang bài học là host cho `getLessonSections()`; không import module M3, phần thảo luận của M3 được nạp qua slot. |

## 8. Lịch học và thời khóa biểu

| Thuộc tính | Đặc tả |
|---|---|
| Route / layout | Tab `Lịch học` trong `/courses/:courseId`; thời khóa biểu cá nhân `/me/schedule`, layout `default` và có nav cho Sinh viên. |
| Vai trò | Tab khóa: chủ khóa và Sinh viên đã ghi danh được xem; chỉ Giảng viên chủ khóa được tạo/sửa/hủy. Thời khóa biểu tổng hợp: Sinh viên. |
| API | Tab khóa: `GET /api/courses/{courseId}/schedules`; tạo `POST` cùng path với `{ title, date, startTime, endTime, roomOrLink }`; sửa `PATCH /api/schedules/{scheduleId}`; hủy `DELETE /api/schedules/{scheduleId}`. Thời khóa biểu cá nhân: `GET /api/me/schedule?page&limit`, trả `{ items, total, page, limit }`, mỗi item gồm dữ liệu Schedule và `courseCode`, `courseTitle`. |
| Trạng thái | **Loading:** skeleton lịch/bảng và pagination. **Error:** hiển thị message server cho lỗi quyền, validation và xung đột giờ; có Thử lại. **Empty:** chưa có buổi học, giảng viên có action tạo; lịch cá nhân trống có giải thích. **Success:** lịch theo ngày/giờ; định dạng ngày/giờ qua helper shared. |
| Hành động chính | Giảng viên tạo, sửa, hủy (ConfirmDialog); validate `startTime < endTime`; hiển thị message server khi trùng lịch. Sinh viên xem lịch khóa và lịch tổng hợp theo trang. StatusBadge theo enum `SCHEDULED`, `RESCHEDULED`, `CANCELLED`. |
| Component | Shared: Tabs trang, DateTimeInput, FormDialog, FormField, Input, Button, ConfirmDialog, StatusBadge `{ type: 'schedule', value: status }`, DataTable, Pagination, DataState, Toast, `formatDateTime`. M1: `ScheduleList`, `ScheduleForm`, `MySchedulePage`. |
| Slot | Tab `schedule` đăng ký qua `course-tabs.jsx`; `/me/schedule` là route riêng của M1. |

## Điểm cần làm rõ trước khi triển khai các bước A1–A5

1. **F0a/F0b và shared UI:** scaffold hiện chưa có nhiều component/hook được liệt kê ở frontend contract (FormField, ConfirmDialog, DataTable, Pagination, FileInput, DateTimeInput, Tabs trang, Toast, `DataState`, hooks, auth). Chờ B merge F0a/F0b và xác nhận import path/export; không tự thêm component trong `shared` ở phạm vi M1.
2. **Design system và hướng dẫn chạy:** `docs/design-system.md` và `frontend/README.md` chưa có. Cần B cung cấp tài liệu design token/hướng dẫn frontend trước khi chọn style cụ thể hoặc thực hiện quy trình lệnh của các bước sau.
3. **Đăng nhập và profile:** OpenAPI `AuthSession.user` hiện chỉ mô tả `id`, `role`, `must_change_password`, trong khi `useAuth()` contract yêu cầu thêm `fullName`, `username`; cần xác nhận profile được lấy từ đâu để hiển thị tên và quyết định trang chủ theo role.
4. **Lưu trữ/xóa khóa:** `DELETE /api/courses/{courseId}` tự quyết định xóa mềm khóa rỗng hay lưu trữ khóa có dữ liệu; API không trả cờ dữ liệu phát sinh để UI biết trước thao tác. Chốt dùng action “Xóa mềm/Lưu trữ” thống nhất hay tách rõ nút Lưu trữ và xử lý khóa rỗng.
5. **Ghi danh thành công:** OpenAPI định nghĩa status 201 nhưng chưa có schema response; xác nhận response để điều hướng thẳng vào khóa vừa ghi danh nếu cần.
6. **Bài giảng:** OpenAPI có GET/POST lesson, không đặc tả PATCH/DELETE lesson dù yêu cầu A4 có sửa/xóa; response schema cho lessons/materials cũng chưa mô tả đầy đủ. Cần bổ sung API/schema trước khi xây các thao tác này.
7. **Upload errors:** OpenAPI mô tả upload không hỗ trợ/quá 50MB bằng `400` và tiêu đề sai bằng `422`; chưa định nghĩa `413`/`415` dù yêu cầu A4 muốn xử lý hai status này. Chốt status thực tế; không ánh xạ giả 400 thành 413/415 ở UI.
8. **Lịch đã hủy:** API danh sách lịch khóa hiện mô tả chỉ trả lịch active, vì vậy UI không thể hiển thị `StatusBadge` `CANCELLED` ở danh sách đó; cần chốt có cần xem lịch đã hủy hay chỉ hiện trạng thái ngay sau thao tác hủy.
9. **Trang danh sách khóa:** API hiện chỉ có danh sách khóa theo người dùng, không có API tìm kiếm khóa công khai để Sinh viên khám phá khóa chưa tham gia. Chốt dùng ghi danh trực tiếp bằng mã trong dialog từ `/courses`.
10. **Test/design-system validation:** frontend contract yêu cầu mỗi trang kiểm thử Loading/Error/Empty và một hành động chính. Khi B merge test utilities/hooks/shared components, cần dùng `renderWithProviders`/`mockAuth`; rà `style=`, mã hex và CSS lạ trước khi hoàn tất mỗi bước.

## File tiền đề chưa có

- `docs/design-system.md`
- `frontend/README.md`

## Skills

Các skill `frontend-component-architect`, `design-system-enforcement` và `frontend-api-integration` không có trong danh sách skill khả dụng của môi trường này; tài liệu được lập theo frontend contract, OpenAPI và scaffold đang có.
