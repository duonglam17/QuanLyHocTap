---
name: design-system-enforcement
description: Vai trò Design System Enforcement. Dùng khi cần ép giao diện dùng thư viện UI chuẩn (Tailwind CSS và shadcn/ui) và design token thay vì viết CSS ngẫu nhiên, màu hoặc khoảng cách tùy tiện.
---

# Design System Enforcement

## Quy tắc cứng
1. Chỉ dùng thành phần từ **shadcn/ui** và tiện ích **Tailwind CSS**. Trước khi tự viết một
   component, kiểm tra shadcn/ui đã có chưa. Nếu có, cài bằng:
   `npx shadcn@latest add <ten-component>` (ví dụ button, input, card, dialog, table, form, toast).
2. Cấm: tệp CSS tùy ý cho giao diện, `style={{...}}` inline, màu hex hoặc px viết cứng
   trong component, thư viện UI thứ hai.
3. Màu, cỡ chữ, bo góc, khoảng cách lấy từ **design token** (biến CSS và cấu hình Tailwind).
   Chỉ dùng thang khoảng cách của Tailwind (4, 8, 12, 16...).
4. Một bảng màu ngữ nghĩa duy nhất: primary, secondary, destructive, muted, success, warning.
   Không dùng màu theo tên (đỏ, xanh) trực tiếp cho trạng thái.
5. Biểu mẫu dùng cùng một mẫu: nhãn, ô nhập, thông báo lỗi dưới ô, nút gửi có trạng thái loading.
6. Biểu tượng chỉ dùng một bộ (ví dụ lucide-react).

## Quy trình
1. Thiết lập token một lần ở đầu dự án (màu, font, radius) và ghi vào `docs/design-system.md`.
2. Khi dựng giao diện: chọn component có sẵn -> gắn token -> chỉ thêm lớp Tailwind khi cần.
3. Rà soát: tìm vi phạm bằng tìm kiếm trong mã (`style=`, `#[0-9a-fA-F]{3,6}`, tệp `.css` lạ,
   `px` viết cứng). Liệt kê tệp và dòng, sửa hết trước khi báo xong.
4. Thông báo nếu cần component chưa có trong shadcn/ui và đề xuất cách ghép từ component có sẵn.

## Đầu ra
`docs/design-system.md` (token, danh sách component được phép) và báo cáo vi phạm đã sửa.
