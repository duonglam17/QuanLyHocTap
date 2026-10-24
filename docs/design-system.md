# Design system - LMS Mini

Giao diện ưu tiên khả năng đọc, phân cấp thông tin rõ ràng và tương phản đủ tốt cho môi trường học tập. Màu sắc được gọi bằng tên ngữ nghĩa; module chỉ dùng utility Tailwind và component dùng chung, không đặt màu trực tiếp.

## Token

Các token màu là giá trị HSL, được khai báo tại `frontend/src/shared/styles/globals.css` và ánh xạ sang utility Tailwind trong `frontend/tailwind.config.js`.

| Token | Ý nghĩa | Giá trị mặc định |
|---|---|---|
| `background` / `foreground` | Nền và nội dung chính | `0 0% 100%` / `222 47% 11%` |
| `primary` / `primary-foreground` | Hành động chính, liên kết | `221 83% 53%` / `210 40% 98%` |
| `secondary` / `secondary-foreground` | Nền hành động phụ | `210 40% 96%` / `222 47% 11%` |
| `destructive` / `destructive-foreground` | Hành động hoặc trạng thái nguy hiểm | `0 72% 51%` / `210 40% 98%` |
| `muted` / `muted-foreground` | Nền và chữ ít nhấn | `210 40% 96%` / `215 16% 47%` |
| `success` / `success-foreground` | Thành công, đã hoàn tất | `142 71% 35%` / `0 0% 100%` |
| `warning` / `warning-foreground` | Cảnh báo, sắp đến hạn | `38 92% 50%` / `222 47% 11%` |
| `accent` / `accent-foreground` | Nền hover và lựa chọn | `210 40% 96%` / `222 47% 11%` |
| `card` / `card-foreground` | Bề mặt thẻ | `0 0% 100%` / `222 47% 11%` |
| `popover` / `popover-foreground` | Menu, select, popover | `0 0% 100%` / `222 47% 11%` |
| `border`, `input`, `ring` | Viền, trường nhập, focus ring | `214 32% 91%` / `214 32% 91%` / `221 83% 53%` |

| Nhóm | Quy ước |
|---|---|
| Phông chữ | `Inter`, `ui-sans-serif`, `system-ui`, `"Segoe UI"`, `sans-serif`; dùng font hệ thống để giữ đủ dấu tiếng Việt và không phụ thuộc tải font bên ngoài. |
| Bo góc | `--radius: 0.5rem`; `rounded-sm`, `rounded-md`, `rounded-lg` lần lượt giảm/giữ/tăng theo token Tailwind. |
| Khoảng cách | Dùng thang spacing mặc định Tailwind (bội số 0.25rem); ưu tiên `gap-*`, `p-*`, `px-*`, `py-*`, không tự định nghĩa khoảng cách theo trang. |
| Focus | Điều khiển bằng bàn phím có `focus-visible:ring-2 focus-visible:ring-ring`; không loại bỏ focus indicator. |
| Breakpoints | Tailwind mặc định; bố cục cần hoạt động từ 768px, kiểm tra desktop 1280x720. |
| Thời gian và điểm | Dùng `formatDateTime` theo `Asia/Ho_Chi_Minh`; `formatScore(null)` hiển thị “Chưa có”. |

## Component được phép

Ưu tiên import qua `frontend/src/shared/components/index.js`; chỉ mở rộng shared khi thành phần có thể dùng lại.

| Nhóm | Thành phần |
|---|---|
| Atoms | Button, Input, Textarea, Label, Select, Checkbox, Switch, Badge, Avatar, Skeleton, Spinner, Tooltip, Dialog, AlertDialog, DropdownMenu, Tabs, Popover, Table, Form |
| Molecules | FormField, SearchInput, PageHeader, EmptyState, ErrorState, ConfirmDialog, Pagination, FileInput, DateTimeInput, StatusBadge, Toast |
| Organisms | DataState, DataTable, FormDialog |
| Utilities | `cn`, `formatDateTime`, `formatScore`, `formatFileSize` |

Trạng thái màu dùng `StatusBadge` với token ngữ nghĩa. Nội dung người dùng luôn render dạng văn bản; không dùng `dangerouslySetInnerHTML`, style inline hoặc mã màu trực tiếp. Mỗi màn hình đọc dữ liệu phải thể hiện đủ Loading, Error và Empty qua `DataState`.

## Thư viện tương tác

Các primitive Radix được đóng gói bằng component tại `frontend/src/shared/components/atoms/`; module không import Radix trực tiếp. `sonner` chỉ dùng thông qua API `toast` trong shared. Các thành phần đơn giản dùng HTML native để giảm số phụ thuộc.
