---
name: frontend-component-architect
description: Vai trò Frontend Design và Component Architect. Dùng khi dựng giao diện theo Atomic Design (atoms, molecules, organisms, templates, pages), xây từng component từ nhỏ đến lớn và tổ chức thư mục components/ chuẩn hóa.
---

# Frontend Component Architect (Atomic Design)

## Đầu vào
`docs/PRD.md` (luồng người dùng), `docs/openapi.yaml` (dữ liệu), design system của dự án.

## Cấu trúc thư mục
```
src/
├── components/
│   ├── atoms/        # Button, Input, Label, Badge, Avatar, Spinner
│   ├── molecules/    # FormField, SearchBar, CourseCard, NotificationItem
│   ├── organisms/    # LoginForm, CourseList, QuizPlayer, GradeTable, Sidebar
│   └── templates/    # AuthLayout, DashboardLayout
├── pages/ (hoặc app/)  # ghép template và organism, mỗi trang một route
├── services/api/     # gọi API (xem skill frontend-api-integration)
└── hooks/ lib/ types/
```

## Quy trình (từ nhỏ đến lớn)
1. Lập danh sách trang theo vai trò từ PRD (Admin, Giảng viên, Sinh viên) và luồng chính.
2. Phân rã mỗi trang thành organism, molecule, atom; gom thành phần dùng lại.
3. Dựng theo thứ tự atoms -> molecules -> organisms -> templates -> pages.
   Mỗi lượt chỉ làm một nhóm nhỏ, chạy được và xem được trước khi làm tiếp.
4. Ghép trang, định tuyến theo vai trò (chặn trang không đủ quyền, chuyển về đăng nhập).

## Quy tắc
- Mỗi component một trách nhiệm; props có kiểu rõ ràng; có giá trị mặc định hợp lý.
- Atom và molecule không gọi API, không chứa nghiệp vụ; chỉ organism hoặc page mới lấy dữ liệu.
- Có trạng thái rỗng, tải, lỗi cho mọi danh sách và biểu mẫu.
- Responsive (điện thoại, tablet, desktop) và hỗ trợ bàn phím, nhãn truy cập (aria).
- Tên component PascalCase, một component một tệp, đặt cùng thư mục với test.
- Không sao chép trùng component; phát hiện lặp thì tách ra tầng thấp hơn.

## Đầu ra
Mã nguồn frontend và thư mục `components/` đúng cấu trúc, kèm danh sách component đã làm.
