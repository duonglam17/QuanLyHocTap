# Đặc tả Màn hình Giao diện Module M1 (Tài khoản, Khóa học, Bài giảng, Lịch học)

> **Tài liệu Bước 0 - Frontend M1**  
> Đối chiếu chuẩn theo [`docs/openapi/m1.yaml`](file:///d:/Project/QuanLyHocTap/docs/openapi/m1.yaml), [`docs/frontend-contracts.md`](file:///d:/Project/QuanLyHocTap/docs/frontend-contracts.md), [`docs/design-system.md`](file:///d:/Project/QuanLyHocTap/docs/design-system.md) và [`docs/PRD.md`](file:///d:/Project/QuanLyHocTap/docs/PRD.md).  
> **Điều kiện tiên quyết:** B đã hoàn tất và merge F0a, F0b (`frontend/src/shared/**`, `frontend/src/app/**`, Design System tokens, Shared Components và Test Utilities đã hoạt động 100%).

---

## I. Quy ước và Tiêu chuẩn Chung Module M1

1. **Phân quyền và Định tuyến (Route Guarding):**
   - Mọi route (trừ route công khai `/login`) được bọc qua `<RequireAuth roles={[...]} />`. Nếu người dùng chưa đăng nhập, chuyển hướng về `/login` kèm lưu đường dẫn đang xem dở; nếu thiếu quyền, hiển thị trang 403 Forbidden.
2. **Xử lý 3 Trạng thái Mạng (Network States):**
   - **Loading:** Luôn có `Skeleton` cho danh sách/bảng hoặc `Spinner` cho form; khóa (disable) các nút thao tác để chống double-submit (EC-04).
   - **Error:** Sử dụng `<ErrorState />` hiển thị chính xác `message` từ máy chủ kèm nút "Thử lại" (Fallback UI). Lỗi form 422 gắn message vào từng `<FormField />`. Ánh xạ mã lỗi 401 (phiên hết hạn / EC-14), 403 (không có quyền / IDOR EC-01), 404 (không tìm thấy), 409 (xung đột dữ liệu / EC-23), 429 (rate limit / EC-08, EC-22).
   - **Success & Empty State:** Hiển thị dữ liệu chuẩn hóa; nếu danh sách rỗng thì hiển thị `<EmptyState />` với tiêu đề, mô tả và nút hành động gợi ý cụ thể theo vai trò người dùng.
3. **Tuân thủ Design System (Design System Enforcement):**
   - 100% sử dụng token ngữ nghĩa Tailwind CSS và thành phần từ `frontend/src/shared/components/`.
   - Tuyệt đối KHÔNG sử dụng `style={{...}}` inline, KHÔNG dùng mã màu hex (`#...`), KHÔNG dùng `dangerouslySetInnerHTML`.
   - Phông chữ hệ thống hỗ trợ tiếng Việt đầy đủ dấu; thời gian định dạng bằng `formatDateTime` (`Asia/Ho_Chi_Minh`), kích thước tệp dùng `formatFileSize`.
   - Responsive tốt từ màn hình tablet (>= 768px) đến desktop (1280x720) theo NFR-10 và NFR-11.
4. **Kiến trúc Slot & Không phụ thuộc chéo (Atomic Design & Loose Coupling):**
   - M1 tuyệt đối không import code từ module `m2` hoặc `m3`.
   - M1 cung cấp slot tab: `modules/m1/course-tabs.jsx` đăng ký hai tab: `lessons` (Bài giảng) và `schedule` (Lịch học).
   - Trang chi tiết khóa học `/courses/:courseId` nạp danh sách tab từ `getCourseTabs(role)` từ `shared/lib/slots.js`, truyền props `{ courseId, course, role, isOwner }`.
   - Trang bài học `/lessons/:lessonId` render các phần nội dung từ `getLessonSections(role)` từ `shared/lib/slots.js` (nơi khu vực thảo luận của M3 sẽ được tự động cắm vào).

---

## II. Đặc tả Chi tiết Các Màn hình M1

### 1. Màn hình Đăng nhập (US-01, EC-08)
- **Đường dẫn (Route):** `/login`
- **Layout:** `bare` (toàn màn hình, không có thanh sidebar hay topbar điều hướng)
- **Truy cập:** Công khai (`public: true`, áp dụng cho cả người chưa đăng nhập)
- **Vai trò:** Khách chưa xác thực, Admin, Giảng viên, Sinh viên.
- **API tương tác:**
  - `POST /api/auth/login` (Body: `{ username, password }`)
  - Response 200: `AuthSession` (`{ accessToken, refreshToken, user: { id, role, must_change_password } }`)
- **3 Trạng thái mạng:**
  - **Idle / Initial:** Form nhập dữ liệu sạch sẽ, con trỏ đặt tại ô tên đăng nhập/email.
  - **Loading:** Nút "Đăng nhập" bị khóa, hiển thị `<Spinner />`, các trường nhập bị vô hiệu hóa tạm thời.
  - **Error:**
    - Lỗi thiếu trường (400): Hiển thị thông báo validation dưới từng ô nhập.
    - Sai tên đăng nhập hoặc mật khẩu (401): Hiển thị `message` từ server ("Tên đăng nhập hoặc mật khẩu không đúng").
    - Tài khoản bị tạm khóa 15 phút (403, `TEMPORARY_LOCKED`): Hiển thị `message` từ server ("Tài khoản bị tạm khóa 15 phút do nhập sai quá 5 lần").
    - Tài khoản bị khóa hẳn (403, `LOCKED`): Hiển thị `message` từ server ("Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin").
    - Quá giới hạn request (429): Hiển thị lỗi rate limit ("Bạn đã thao tác quá nhanh, vui lòng thử lại sau").
  - **Success:** Lưu phiên qua `useAuth().login()`, chuyển hướng về trang người dùng đang xem dở hoặc trang chủ theo vai trò (Admin -> `/admin/users`, Giảng viên/Sinh viên -> `/courses`).
- **Hành động chính:**
  - Nhập tên đăng nhập hoặc email và mật khẩu.
  - Bật/tắt ẩn hiện mật khẩu.
  - Gửi form đăng nhập; xử lý chuyển trang mượt mà.
- **Component dự kiến:**
  - *Shared:* `Button`, `Input`, `Label`, `FormField`, `Spinner`, `StatusMessage`, `toast`.
  - *Module M1:* Organism `LoginForm`, Page `LoginPage`.
- **Slot liên quan:** Không có.

---

### 2. Màn hình Danh sách Khóa học (US-03, US-04)
- **Đường dẫn (Route):** `/courses`
- **Layout:** `default` (có sidebar điều hướng, header và breadcrumb)
- **Nav Menu:** `{ label: 'Khóa học', icon: 'BookOpen', order: 10, group: 'main' }`
- **Vai trò:** `ADMIN`, `GIANG_VIEN`, `SINH_VIEN`.
- **API tương tác:**
  - `GET /api/courses`
  - Response 200: `{ items: Course[] }` (mỗi Course gồm: `id`, `code`, `title`, `description`, `semester`, `ownerId`, `enrollment_key`, `status`: `DRAFT` | `PUBLISHED` | `ARCHIVED`).
- **3 Trạng thái mạng:**
  - **Loading:** Hiển thị lưới card `<Skeleton />` (hoặc các dòng skeleton bảng).
  - **Error:** Hiển thị `<ErrorState />` kèm `message` server và nút "Thử lại" gọi refetch.
  - **Empty:**
    - Sinh viên: `<EmptyState title="Chưa tham gia khóa học nào" description="Hãy nhập mã ghi danh được giảng viên cung cấp để tham gia lớp học." action={<Button onClick={openEnrollDialog}>Ghi danh ngay</Button>} />`
    - Giảng viên: `<EmptyState title="Chưa có khóa học nào" description="Bắt đầu tạo khóa học mới để chia sẻ bài giảng và quản lý sinh viên." action={<Button onClick={openCreateDialog}>Tạo khóa học mới</Button>} />`
    - Admin: `<EmptyState title="Không có khóa học" description="Hệ thống chưa có khóa học nào được khởi tạo." />`
  - **Success:** Lưới các thẻ khóa học (`CourseCard`) kèm phân loại học kỳ, trạng thái badge rõ ràng.
- **Hành động chính:**
  - Giảng viên: Nhấn nút "Tạo khóa học mới" (mở `CourseFormDialog`), sao chép nhanh mã ghi danh (với khóa đã xuất bản), xem trạng thái khóa học (`StatusBadge`).
  - Sinh viên: Nhấn nút "Tham gia khóa học" (mở `EnrollmentDialog`).
  - Mọi vai trò: Bấm vào thẻ để chuyển hướng đến `/courses/:courseId`.
- **Component dự kiến:**
  - *Shared:* `PageHeader`, `DataState`, `Button`, `StatusBadge`, `Skeleton`, `EmptyState`, `ErrorState`, `toast`.
  - *Module M1:* Molecule `CourseCard`, Organisms `CourseList`, `CourseFormDialog`, `EnrollmentDialog`, Page `CoursesPage`.
- **Slot liên quan:** Điểm neo mở vào trang chi tiết khóa học.

---

### 3. Màn hình Chi tiết Khóa học (US-03, US-04, có Tab Slot)
- **Đường dẫn (Route):** `/courses/:courseId`
- **Layout:** `default`
- **Vai trò:** `ADMIN`, `GIANG_VIEN` (chủ sở hữu hoặc quản lý), `SINH_VIEN` (đã ghi danh).
- **API tương tác:**
  - `GET /api/courses/{courseId}`
  - Response 200: `{ course: Course }`
- **3 Trạng thái mạng:**
  - **Loading:** Skeleton toàn trang (phần header khóa học và thanh tabs).
  - **Error:** `<ErrorState />` (nếu 403: "Bạn không có quyền truy cập khóa học này"; nếu 404: "Khóa học không tồn tại").
  - **Empty:** Không áp dụng trực tiếp cho thông tin khóa; tab con bên trong sẽ tự xử lý Empty riêng.
  - **Success:** Header hiển thị tên khóa, mã môn, học kỳ, mã ghi danh (với chủ khóa), StatusBadge (`DRAFT` | `PUBLISHED` | `ARCHIVED`). Nếu khóa ở trạng thái `ARCHIVED`, hiển thị banner cảnh báo: "Khóa học đã được lưu trữ (chỉ đọc)".
- **Hành động chính:**
  - Xem thông tin tổng quan khóa học.
  - Giảng viên sở hữu: Xuất bản khóa học (`PUBLISHED`), Chỉnh sửa thông tin, Lưu trữ khóa học (`ARCHIVED`), sao chép Enrollment Key.
  - Chuyển đổi linh hoạt giữa các tab: Bài giảng, Lịch học, Bài tập, Bảng điểm, Đề thi, v.v.
- **Component dự kiến:**
  - *Shared:* `PageHeader`, `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`, `StatusBadge`, `Button`, `Badge`, `ConfirmDialog`, `toast`.
  - *Module M1:* Molecule `CourseHeader`, Organism `CourseManagementBar`, Page `CourseDetailPage`.
- **Slot liên quan (Quan trọng):**
  - Host chứa các tab: gọi `getCourseTabs(role)` từ `shared/lib/slots.js`.
  - Truyền đầy đủ props cho component tab: `{ courseId, course, role, isOwner }`.
  - Tự động tích hợp các tab của M2 (`assignments`, `grades`) và M3 (`quizzes`, `announcements`) mà không import trực tiếp mã của M2/M3.

---

### 4. Quản lý Khóa học (Tạo, Sửa, Xuất bản, Lưu trữ - US-03, EC-09)
- **Đường dẫn (Route):**
  - Tạo mới: Hộp thoại `CourseFormDialog` kích hoạt từ `/courses`.
  - Sửa / Xuất bản / Lưu trữ: Toolbar/menu thao tác trên header của `/courses/:courseId`.
- **Vai trò:** `GIANG_VIEN` (chủ sở hữu khóa học `course.ownerId === user.id`), `ADMIN` (quyền lưu trữ).
- **API tương tác:**
  - Tạo: `POST /api/courses` (Body: `{ code, title, description?, semester, enrollmentKey? }`)
  - Cập nhật: `PATCH /api/courses/{courseId}` (Body: `{ code?, title?, description?, semester?, enrollmentKey? }`)
  - Xuất bản: `PATCH /api/courses/{courseId}/publish`
  - Lưu trữ: `PATCH /api/courses/{courseId}/archive`
  - Xóa mềm/Lưu trữ: `DELETE /api/courses/{courseId}` (Tự động chuyển lưu trữ nếu đã có dữ liệu phát sinh theo EC-09).
- **3 Trạng thái mạng:**
  - **Loading:** Nút "Lưu" / "Xác nhận" hiển thị `<Spinner />` và bị disable.
  - **Error:**
    - Lỗi 409: "Mã môn học hoặc mã ghi danh đã được sử dụng" hoặc "Khóa học đã lưu trữ không thể sửa đổi".
    - Lỗi 422: Gắn lỗi vào từng trường tương ứng trong form.
    - Lỗi 403: "Bạn không có quyền chỉnh sửa khóa học này".
  - **Success:** Đóng modal, hiển thị `toast.success`, làm mới cache dữ liệu (`invalidate` queries).
- **Hành động chính:**
  - Nhập thông tin khóa học: Mã môn, Tên khóa học, Học kỳ, Mô tả, Tùy chọn đặt trước mã ghi danh (6-8 ký tự) hoặc để server tự sinh.
  - Xuất bản khóa học với `<ConfirmDialog />` để mở cho sinh viên ghi danh.
  - Lưu trữ khóa học với `<ConfirmDialog />` (khóa đã lưu trữ sẽ khóa toàn bộ hoạt động nộp bài/làm bài và chuyển sang chế độ chỉ đọc).
- **Component dự kiến:**
  - *Shared:* `FormDialog`, `FormField`, `Input`, `Textarea`, `Button`, `ConfirmDialog`, `toast`, `Spinner`.
  - *Module M1:* Organism `CourseFormDialog`, Molecule `CourseActionsDropdown`.
- **Slot liên quan:** Nằm trong trang danh sách và trang chi tiết khóa học.

---

### 5. Ghi danh Khóa học bằng Mã (US-04, EC-22)
- **Đường dẫn (Route):** Hộp thoại `EnrollmentDialog` kích hoạt từ `/courses`.
- **Vai trò:** `SINH_VIEN`.
- **API tương tác:**
  - `POST /api/courses/enroll` (Body: `{ enrollment_key }`)
  - Response 201: Thành công.
- **3 Trạng thái mạng:**
  - **Idle / Initial:** Input mã ghi danh trống, có gợi ý định dạng (6-8 ký tự, phân biệt chữ hoa/thường).
  - **Loading:** Khóa nút "Tham gia", hiển thị icon spinner.
  - **Error:**
    - Mã sai hoặc khóa chưa xuất bản (404): "Mã ghi danh không tồn tại hoặc chưa xuất bản".
    - Đã ghi danh trước đó (409): "Bạn đã là thành viên của khóa học này".
    - Nhập sai quá nhiều lần (429 - EC-22): "Bạn đã thử quá nhiều lần, vui lòng đợi 1 phút".
    - Trống mã (400): "Vui lòng nhập mã ghi danh".
  - **Success:** Thông báo `toast.success("Ghi danh khóa học thành công")`, đóng hộp thoại, tự động chuyển hướng hoặc refetch danh sách khóa học.
- **Hành động chính:**
  - Nhập mã ghi danh (tự động cắt khoảng trắng thừa).
  - Gửi yêu cầu ghi danh.
- **Component dự kiến:**
  - *Shared:* `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `FormField`, `Input`, `Button`, `Spinner`, `toast`.
  - *Module M1:* Organism `EnrollmentDialog`.
- **Slot liên quan:** Không có.

---

### 6. Quản lý Người dùng - Admin (US-02, EC-08, EC-14)
- **Đường dẫn (Route):** `/admin/users`
- **Layout:** `default`
- **Nav Menu:** `{ label: 'Người dùng', icon: 'Users', order: 20, group: 'admin' }`
- **Vai trò:** `ADMIN`.
- **API tương tác:**
  - Lấy danh sách: `GET /api/users?search&role&status&page&limit` (Response: `{ items: ManagedUser[], total, page, limit }`)
  - Tạo mới: `POST /api/users` (Body: `{ fullName, username, email, role }`; Response 201: `{ user, initialPassword }`)
  - Đổi trạng thái khóa/mở: `PATCH /api/users/{userId}/status` (Body: `{ status: 'ACTIVE' | 'LOCKED' }`)
  - Đổi vai trò: `PATCH /api/users/{userId}/role` (Body: `{ role: 'ADMIN' | 'GIANG_VIEN' | 'SINH_VIEN' }`)
  - Xóa mềm: `DELETE /api/users/{userId}`
- **3 Trạng thái mạng:**
  - **Loading:** Bảng hiển thị hàng loạt dòng `<Skeleton />`.
  - **Error:** `<ErrorState />` hiển thị lỗi máy chủ và nút "Thử lại".
  - **Empty:** `<EmptyState title="Không tìm thấy người dùng" description="Không có người dùng nào khớp với bộ lọc hiện tại." />`
  - **Success:** Bảng dữ liệu `<DataTable />` gồm các cột: Họ tên, Tên đăng nhập, Email, Vai trò, Trạng thái (`StatusBadge`), Ngày tạo, Thao tác.
- **Hành động chính:**
  - Tìm kiếm theo từ khóa (họ tên, username, email) với `SearchInput`.
  - Lọc theo Vai trò (`Select`) và Trạng thái (`Select`).
  - Chuyển trang qua `<Pagination />`.
  - Tạo tài khoản mới: Sau khi tạo, hiển thị popup modal chứa **Mật khẩu ban đầu (initialPassword)** đúng một lần kèm nút "Sao chép mật khẩu" và cảnh báo bảo mật.
  - Khóa / Mở khóa tài khoản: Yêu cầu xác nhận qua `<ConfirmDialog />`. **Đặc biệt:** Vô hiệu hóa nút khóa đối với chính tài khoản Admin đang đăng nhập; nếu server từ chối, hiển thị thông báo lỗi từ server.
  - Thay đổi vai trò người dùng với `<ConfirmDialog />`.
- **Component dự kiến:**
  - *Shared:* `PageHeader`, `DataTable`, `SearchInput`, `Select`, `Pagination`, `StatusBadge`, `ConfirmDialog`, `Button`, `toast`, `EmptyState`, `ErrorState`, `Skeleton`.
  - *Module M1:* Organism `UserFormDialog`, Organism `InitialPasswordModal`, Page `AdminUsersPage`.
- **Slot liên quan:** Không có.

---

### 7. Bài giảng và Tài liệu (US-05, US-06, EC-01, EC-03, EC-18, EC-19, EC-20)
- **Đường dẫn (Route):**
  - Tab trong khóa học: Tab "Bài giảng" tại `/courses/:courseId`.
  - Trang chi tiết bài học: `/lessons/:lessonId`.
- **Layout:** `default`
- **Vai trò:**
  - `GIANG_VIEN` (chủ sở hữu): Thêm bài học, tải lên tài liệu học tập.
  - `SINH_VIEN` (đã ghi danh): Xem bài học, tải tài liệu đính kèm về máy.
  - Khóa đã `ARCHIVED`: Chỉ đọc cho tất cả vai trò.
- **API tương tác:**
  - Danh sách bài & tài liệu: `GET /api/courses/{courseId}/lessons`
  - Tạo bài học: `POST /api/courses/{courseId}/lessons` (Body: `{ title, content?, orderIndex? }`)
  - Danh sách tài liệu của bài: `GET /api/lessons/{lessonId}/materials`
  - Tải lên tài liệu: `POST /api/lessons/{lessonId}/materials` (Multipart form-data: `{ title, file }`)
  - Tải tài liệu về máy (Download): `GET /api/courses/{courseId}/materials/{materialId}/download` (dùng `api.download`, stream nhị phân an toàn kèm xác thực).
- **3 Trạng thái mạng:**
  - **Loading:** Skeleton danh sách cây bài học và tài liệu; thanh tiến trình (`Progress`) khi tải lên tài liệu.
  - **Error:**
    - Lỗi tải tệp quá 50MB (400/413): "Dung lượng tệp vượt quá giới hạn tối đa 50MB".
    - Lỗi định dạng tệp (400/415): "Loại định dạng tệp không được hỗ trợ. Chỉ chấp nhận PDF, DOCX, PPTX, ZIP, RAR".
    - Lỗi không có quyền (403): "Bạn không có quyền truy cập tài liệu này".
  - **Empty:**
    - Giảng viên: `<EmptyState title="Chưa có bài giảng nào" description="Hãy tạo bài học đầu tiên và tải lên tài liệu cho sinh viên." action={<Button onClick={openAddLesson}>Thêm bài học</Button>} />`
    - Sinh viên: `<EmptyState title="Chưa có nội dung bài học" description="Giảng viên chưa đăng tải nội dung cho khóa học này." />`
  - **Success:** Danh sách bài học sắp xếp theo thứ tự `orderIndex`, mỗi bài kèm danh sách tài liệu với biểu tượng file, dung lượng định dạng (`formatFileSize`), nút tải xuống.
- **Hành động chính:**
  - Giảng viên: Tạo bài học mới, tải lên tài liệu bằng `<FileInput />` (có validate kích thước <= 50MB, kiểm tra phần mở rộng tệp, hiển thị tiến trình upload `onProgress`).
  - Sinh viên: Xem bài học, bấm tải tài liệu an toàn qua `api.download` (tên file gốc được giữ nguyên, token không bị lộ trên URL theo BR-11 và EC-18).
- **Component dự kiến:**
  - *Shared:* `DataState`, `FileInput`, `Button`, `FormField`, `Input`, `Textarea`, `Skeleton`, `EmptyState`, `ErrorState`, `toast`.
  - *Module M1:* Molecules `LessonCard`, `MaterialItem`, Organisms `LessonList`, `LessonFormDialog`, `MaterialUploadDialog`, Page `LessonDetailPage`.
- **Slot liên quan (Quan trọng):**
  - Đóng góp tab `lessons` vào `modules/m1/course-tabs.jsx`.
  - Trang bài học `/lessons/:lessonId` đóng vai trò là **Host** nạp các phần mở rộng bài học từ `getLessonSections(role)` (nơi diễn đàn thảo luận của M3 sẽ được cắm vào).

---

### 8. Lịch học và Thời khóa biểu (US-17, US-18, EC-23, EC-24)
- **Đường dẫn (Route):**
  - Tab trong khóa học: Tab "Lịch học" tại `/courses/:courseId`.
  - Thời khóa biểu cá nhân của sinh viên: `/me/schedule` (Nav item: `{ label: 'Lịch học của tôi', icon: 'Calendar', order: 15, group: 'main' }`).
- **Layout:** `default`
- **Vai trò:**
  - Tab khóa học: Giảng viên chủ sở hữu (xem, tạo, sửa, hủy buổi học), Sinh viên đã ghi danh (chỉ xem).
  - Route `/me/schedule`: Sinh viên xem lịch học tổng hợp của tất cả các môn đã ghi danh.
- **API tương tác:**
  - Danh sách lịch khóa: `GET /api/courses/{courseId}/schedules` (Response: `{ schedules: Schedule[] }`)
  - Tạo buổi học: `POST /api/courses/{courseId}/schedules` (Body: `{ title, date, startTime, endTime, roomOrLink }`)
  - Cập nhật buổi học: `PATCH /api/schedules/{scheduleId}` (Body: `{ title?, date?, startTime?, endTime?, roomOrLink? }`)
  - Hủy buổi học: `DELETE /api/schedules/{scheduleId}`
  - Thời khóa biểu cá nhân: `GET /api/me/schedule?page&limit` (Response: `{ items: (Schedule & { courseCode, courseTitle })[], total, page, limit }`)
- **3 Trạng thái mạng:**
  - **Loading:** Skeleton danh sách các buổi học / lịch trình theo ngày.
  - **Error:**
    - Lỗi trùng giờ học (409 - EC-23): Hiển thị đúng thông báo máy chủ "Khung giờ bị trùng với buổi học đã tồn tại trên hệ thống".
    - Lỗi giờ không hợp lệ (422): "Giờ kết thúc phải sau giờ bắt đầu".
    - Lỗi khóa học đã lưu trữ (409): "Khóa học đã lưu trữ, không thể chỉnh sửa lịch học".
  - **Empty:**
    - Tab khóa: `<EmptyState title="Chưa có lịch học" description="Chưa có buổi học nào được lên lịch cho khóa học này." />`
    - Lịch cá nhân: `<EmptyState title="Không có lịch học" description="Bạn không có buổi học nào trong thời gian tới." />`
  - **Success:** Danh sách buổi học sắp xếp theo ngày và giờ tăng dần. Buổi học sắp diễn ra gần nhất được làm nổi bật. StatusBadge: `SCHEDULED` (Đã lên lịch), `RESCHEDULED` (Đổi lịch), `CANCELLED` (Đã hủy).
- **Hành động chính:**
  - Giảng viên: Tạo buổi học với `<DateTimeInput />`, chỉnh sửa thời gian/phòng học/link, hủy buổi học qua `<ConfirmDialog />`.
  - Sinh viên: Xem lịch chi tiết theo từng khóa học hoặc xem lịch tổng hợp toàn bộ các môn tại `/me/schedule`, phân trang đầy đủ.
- **Component dự kiến:**
  - *Shared:* `DataState`, `DateTimeInput`, `FormField`, `Input`, `Button`, `ConfirmDialog`, `StatusBadge`, `Pagination`, `EmptyState`, `ErrorState`, `Skeleton`, `toast`.
  - *Module M1:* Molecules `ScheduleItem`, `ScheduleCard`, Organisms `ScheduleList`, `ScheduleFormDialog`, Page `MySchedulePage`.
- **Slot liên quan:**
  - Đóng góp tab `schedule` vào `modules/m1/course-tabs.jsx`.

---

## III. Bảng Tổng hợp Component Phân tầng (Atomic Design) Module M1

| Tầng (Atomic Level) | Thành phần Module M1 | Nguồn gốc / Ghi chú |
|---|---|---|
| **Atoms & Molecules từ Shared** | `Button`, `Input`, `Textarea`, `Label`, `Select`, `Checkbox`, `Switch`, `Badge`, `Avatar`, `Skeleton`, `Spinner`, `Tooltip`, `Dialog`, `AlertDialog`, `DropdownMenu`, `Tabs`, `Popover`, `Table`, `FormField`, `SearchInput`, `PageHeader`, `ConfirmDialog`, `FileInput`, `DateTimeInput`, `StatusBadge`, `Pagination`, `toast` | Nhập trực tiếp từ `@/shared/components` |
| **M1 Molecules** | `CourseCard`, `CourseHeader`, `LessonCard`, `MaterialItem`, `ScheduleItem`, `ScheduleCard`, `UserRowActions` | Xây dựng trong `frontend/src/modules/m1/components/` |
| **M1 Organisms** | `LoginForm`, `CourseList`, `CourseFormDialog`, `EnrollmentDialog`, `LessonList`, `LessonFormDialog`, `MaterialUploadDialog`, `ScheduleList`, `ScheduleFormDialog`, `UserFormDialog`, `InitialPasswordModal` | Xây dựng trong `frontend/src/modules/m1/components/` |
| **M1 Pages** | `LoginPage`, `CoursesPage`, `CourseDetailPage`, `LessonDetailPage`, `AdminUsersPage`, `MySchedulePage` | Xây dựng trong `frontend/src/modules/m1/pages/` |
| **M1 Slots** | `course-tabs.jsx` (đóng góp tab `lessons` và `schedule`) | Đặt tại gốc `frontend/src/modules/m1/course-tabs.jsx` |

---

## IV. Các Điểm Cần Làm Rõ / Thắc mắc Kỹ thuật (Mơ hồ)

1. **Thông tin Người dùng trong Phiên đăng nhập (`AuthSession.user`):**
   - OpenAPI `m1.yaml` định nghĩa `AuthSession.user` chỉ gồm: `{ id, role, must_change_password }`.
   - Trong khi đó, `shared/auth/AuthProvider.jsx` và `frontend-contracts.md` mong muốn `user` có cả `fullName` và `username` để hiển thị trên Topbar / Avatar.
   - *Đề xuất:* Trong bước A1, nếu API backend chưa trả `fullName`/`username` trong session, frontend M1 sẽ fallback hiển thị `username` hoặc gọi API lấy profile người dùng (nếu có), hoặc backend m1-core cập nhật nhẹ response login để bổ sung 2 trường này.
2. **Xóa / Chỉnh sửa Bài học (`Lesson`):**
   - Yêu cầu A4 nêu "giảng viên tạo, sửa, xóa bài", tuy nhiên trong `m1.yaml` hiện chỉ có:
     - `GET /api/courses/{courseId}/lessons`
     - `POST /api/courses/{courseId}/lessons`
   - Chưa có endpoint `PATCH /api/lessons/{lessonId}` và `DELETE /api/lessons/{lessonId}`.
   - *Đề xuất:* Khi triển khai bước A4, nếu cần tính năng sửa/xóa bài học, ta sẽ bổ sung endpoint nhẹ này vào `backend/src/modules/m1-core/` và `docs/openapi/m1.yaml` theo đúng quyền hạn được phép sửa lệch API của M1.
3. **Mã phản hồi HTTP khi Upload File (`413` và `415` vs `400`):**
   - Yêu cầu A4 nêu: "xử lý 413 và 415 khi upload".
   - Trong `m1.yaml` hiện tại gom lỗi file không hợp lệ hoặc quá 50MB về mã `400 Bad Request`.
   - *Đề xuất:* Frontend sẽ bắt cả lỗi `413` (Payload Too Large), `415` (Unsupported Media Type) lẫn `400` có thông điệp tương ứng từ server.
4. **Hiển thị Buổi học đã Hủy (`CANCELLED`):**
   - Trong OpenAPI mô tả `GET /api/courses/{courseId}/schedules` trả về các session active. Khi buổi học bị hủy (`DELETE /api/schedules/{scheduleId}`), status chuyển thành `CANCELLED`.
   - Cần thống nhất: API có trả về buổi học `CANCELLED` trong danh sách lịch học của khóa hay không? Nếu có trả về, UI sẽ hiển thị `StatusBadge` màu xám gạch ngang; nếu backend ẩn buổi học đã hủy thì UI chỉ hiển thị thông báo toast sau khi hủy thành công.

---

## V. Tình trạng Sẵn sàng Triển khai (Definition of Ready)

- [x] Đã nghiên cứu kỹ PRD (US-01..06, 17, 18; NFR-10, 11; EC-01, 03, 08, 09, 14, 15, 18..20, 22..24).
- [x] Đã đối chiếu OpenAPI `common.yaml` và `m1.yaml`.
- [x] Đã đọc `docs/frontend-contracts.md` và `docs/design-system.md`.
- [x] **B đã merge F0a và F0b:** Thư mục `shared` và `app` đã đầy đủ hạ tầng.
- [x] Đã kiểm tra bộ 4 lệnh kiểm tra nền tảng (`npm run lint`, `npm test`, `npm run build`, `npm run deps:check`) -> **Tất cả đều đạt 100% (Pass)**.
- [x] Sẵn sàng chuyển sang Bước A1 (US-01 Đăng nhập) khi người dùng phê duyệt tài liệu Bước 0.
