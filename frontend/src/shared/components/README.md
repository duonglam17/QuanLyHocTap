# Shared UI Components

- `atoms/`: primitives có kiểu dáng shadcn/ui và Tailwind; tương tác phức tạp dùng Radix UI.
- `molecules/`: trường biểu mẫu, tìm kiếm, phân trang, trạng thái và tải tệp.
- `organisms/`: DataState, bảng dữ liệu và form dialog.
- `templates/`: khung bố cục trang dùng chung.

Token ngữ nghĩa được khai báo trong `styles/globals.css`, Tailwind config và `docs/design-system.md`.
Import từ `@/shared/components` hoặc module con tương ứng; không tạo biến thể màu tùy ý trong module.
