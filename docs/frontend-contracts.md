# Hợp đồng Frontend dùng chung - LMS Mini

Đặt tại `docs/frontend-contracts.md`. Đây là nguồn sự thật cho cách ba module giao diện M1, M2, M3 dùng chung hạ tầng
và đóng góp vào cùng một ứng dụng. Mọi thay đổi chữ ký phải có **cả 3 người đồng ý** (một PR riêng sửa tài liệu này).
Nếu khung hiện có (`frontend/`) hoặc `docs/architecture.md` khác tài liệu này, ưu tiên khung đã chạy được và ghi khác biệt ở mục 11.

## 1. Sở hữu và nguyên tắc
| Vùng | Chủ | Ghi chú |
|---|---|---|
| `frontend/src/app/**`, `frontend/src/shared/**`, cấu hình gốc của `frontend/` | B | Người khác không sửa; cần gì thì nhờ B hoặc đề xuất PR nhỏ cho B duyệt |
| `frontend/src/modules/m1/**` | A | Tài khoản, khóa học, bài giảng, lịch học |
| `frontend/src/modules/m2/**` | B | Bài tập, chấm bài, bảng điểm |
| `frontend/src/modules/m3/**` | C | Trắc nghiệm, thông báo, thảo luận |

1. Module KHÔNG import code của module khác. Chỉ import từ `shared` và đóng góp vào các **slot** (mục 4).
2. Mỗi người sở hữu cả backend và frontend của module mình, nên được sửa `backend/src/modules/mX/**` và `docs/openapi/mX.yaml`
   khi tích hợp phát hiện API sai lệch (sửa nhỏ, nêu rõ trong PR).
3. Dữ liệu và tên trường lấy từ `docs/openapi/mX.yaml` và Swagger UI `/api-docs`.
4. Giao diện chỉ dùng Tailwind CSS và shadcn/ui, token trong `docs/design-system.md`.

## 2. Cấu trúc thư mục
```
frontend/src/
├── app/                      # router, layout, điều hướng, trang 403/404, error boundary
├── shared/
│   ├── api/                  # client dùng chung
│   ├── auth/                 # AuthProvider, useAuth, RequireAuth
│   ├── hooks/                # useApiQuery, useApiMutation
│   ├── components/{atoms,molecules,organisms,templates}/
│   ├── lib/                  # formatters, cn
│   └── test-utils/           # renderWithProviders, mockAuth
└── modules/mX/
    ├── routes/               # mảng routes kèm metadata
    ├── pages/
    ├── components/
    ├── api/                  # hàm gọi API của module
    └── course-tabs.jsx | lesson-sections.jsx | header-widget.jsx   # slot, tùy module
```

## 3. Route và điều hướng
Mỗi tệp `modules/mX/routes/*.jsx` export mảng `routes`. Router tự nạp bằng `import.meta.glob`, menu bên trái tự dựng từ metadata.
```
{
  path: '/courses',                       // đường dẫn trên trình duyệt
  element: <CoursesPage />,               // hoặc dùng React.lazy
  roles: ['ADMIN','GIANG_VIEN','SINH_VIEN'],   // bắt buộc; [] nghĩa là chỉ cần đăng nhập
  public: false,                          // true: không cần đăng nhập (ví dụ /login)
  layout: 'default',                      // 'default' (có menu) hoặc 'bare' (toàn màn hình, dùng cho phòng thi và đăng nhập)
  nav: { label: 'Khóa học', icon: 'BookOpen', order: 10, group: 'main' }   // tùy chọn; không có thì không hiện ở menu
}
```
Người dùng thiếu quyền vào route: trang 403. Chưa đăng nhập: chuyển về `/login` và quay lại trang cũ sau khi đăng nhập.

## 4. Slot (cách module đóng góp vào trang của module khác mà không import nhau)
Mỗi slot được nạp bằng `import.meta.glob` với mẫu đường dẫn cố định:
| Slot | Tệp | Export mặc định | Nơi hiển thị (chủ) |
|---|---|---|---|
| Tiện ích thanh trên cùng | `modules/mX/header-widget.jsx` | Component `() => JSX` | Topbar (B) |
| Tab trang chi tiết khóa học | `modules/mX/course-tabs.jsx` | Mảng `{ id, label, order, roles, Component }`; `Component` nhận `{ courseId, course, role, isOwner }` | Trang chi tiết khóa học (A) |
| Phần trong trang bài học | `modules/mX/lesson-sections.jsx` | Mảng `{ id, order, roles, Component }`; `Component` nhận `{ lessonId, courseId, role, isOwner }` | Trang bài học (A) |

Phân bổ: M1 đóng góp tab `lessons`, `schedule`; M2 tab `assignments`, `grades`; M3 tab `quizzes`, `announcements`,
phần bài học `discussion`, tiện ích `NotificationBell`.

## 5. API client (`shared/api`)
```
api.get(path, { params, signal, headers })
api.post(path, body, { signal, headers })      // tương tự api.put, api.patch, api.delete
api.upload(path, formData, { onProgress, headers })
api.download(path, { filename })               // tải tệp có kèm xác thực, lưu bằng trình duyệt
```
- Gốc là `/api`; Vite proxy tới backend khi chạy dev. Gắn token tự động; 401 thì thử làm mới phiên một lần theo ADR, nếu không được thì đăng xuất.
- Trả về dữ liệu đã parse. Lỗi ném `ApiError { status, code, message, details }`; với 422, `details` là `[{ field, message }]`.
- Hàm của module (`modules/mX/api/*.js`) gọi client này, mỗi hàm một endpoint, có ghi chú `US-xx`.

## 6. Xác thực (`shared/auth`)
```
useAuth() -> { user: { id, fullName, username, role } | null, status: 'loading'|'authenticated'|'anonymous',
               login(username, password), logout(), hasRole(...roles) }
<RequireAuth roles={[...]}>...</RequireAuth>
```
Cách lưu token và làm mới phiên theo ADR trong `docs/architecture.md`. Trang đăng nhập do M1 viết, dùng `login` của `useAuth`.

## 7. Dữ liệu và 3 trạng thái
```
useApiQuery(key, fetcher, { enabled, refetchInterval }) -> { data, error, status: 'loading'|'error'|'success', refetch }
useApiMutation(mutationFn, { onSuccess, invalidate: [key,...] }) -> { mutate, status, error, fieldErrors }
<DataState query={q} isEmpty={(data)=>boolean} empty={{ title, description, action }} loading={<Skeleton/>}>{(data)=>...}</DataState>
```
`DataState` luôn hiển thị: Loading (skeleton), Error (ErrorState có nút "Thử lại"), Empty (EmptyState có giải thích và hành động), Success.
Nếu khung dùng thư viện truy vấn (ví dụ TanStack Query) thì các hook trên chỉ là lớp bọc mỏng; module chỉ dùng đúng tên ở đây.

## 8. Thành phần dùng chung B phải cung cấp (PR nền tảng)
| Nhóm | Thành phần |
|---|---|
| Atoms (bọc shadcn/ui) | Button, Input, Textarea, Label, Select, Checkbox, Switch, Badge, Avatar, Skeleton, Spinner, Tooltip |
| Molecules | FormField (nhãn + ô + lỗi), SearchInput, PageHeader, EmptyState, ErrorState, ConfirmDialog, Pagination, FileInput (kiểm tra loại và dung lượng, hiển thị tiến trình), DateTimeInput, StatusBadge (xem dưới), Toast (`toast.success`, `toast.error`) |
| Organisms | DataTable (cột, hàng, phân trang, trạng thái rỗng và đang tải), FormDialog, Tabs trang, Stepper nếu cần |
| Tiện ích | `formatDateTime(iso)` (Asia/Ho_Chi_Minh, vi-VN), `formatScore(n)` (null thành "Chưa có"), `formatFileSize`, `cn` |
| Test | `renderWithProviders`, `mockAuth(role)` |

`StatusBadge` nhận `{ type, value }` và ánh xạ enum sang nhãn và màu ngữ nghĩa:
`account` (ACTIVE, LOCKED, TEMPORARY_LOCKED), `course` (DRAFT, PUBLISHED, ARCHIVED), `submission` (SUBMITTED, SUBMITTED_LATE, GRADED),
`attempt` (IN_PROGRESS, SUBMITTED, AUTO_SUBMITTED), `schedule` (SCHEDULED, RESCHEDULED, CANCELLED), cùng trạng thái đề thi theo quyết định ở backend.

## 9. Quy tắc giao diện
- Nội dung tiếng Việt, đủ dấu; phông chữ hỗ trợ tiếng Việt.
- Mọi màn hình lấy dữ liệu có đủ Loading, Error, Empty. Nút gửi bị khóa khi đang xử lý. Thao tác xóa, khóa, lưu trữ dùng ConfirmDialog.
- Thông báo lỗi hiển thị `message` từ server; lỗi 422 gắn vào từng trường. Điểm null hiển thị "Chưa có".
- Không dùng `style` inline, màu hex, `dangerouslySetInnerHTML`; nội dung người dùng nhập luôn render dạng văn bản.
- Responsive từ 768px trở lên và desktop 1280x720 (NFR-11); chạy tốt trên Chrome, Firefox, Edge, Safari bản mới (NFR-10).
- Thời gian theo máy chủ là chuẩn; không dựa vào đồng hồ máy khách để quyết định hạn nộp hay giờ thi.

## 10. Kiểm thử
Vitest và Testing Library. Mỗi trang có test cho 3 trạng thái và một hành động chính, mock hàm trong `modules/mX/api`.
Dùng `renderWithProviders` và `mockAuth(role)` từ `shared/test-utils`. E2E bằng Playwright thuộc giai đoạn 5.

## 11. Ghi chú khác biệt so với khung hiện có
(Điền tại đây nếu có.)
