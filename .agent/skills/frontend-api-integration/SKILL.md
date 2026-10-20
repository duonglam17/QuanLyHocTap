---
name: frontend-api-integration
description: Vai trò API Integration cho frontend. Dùng khi nối giao diện với API backend theo hợp đồng OpenAPI và xử lý triệt để 3 trạng thái mạng Loading, Error (có Fallback UI), Success (gồm Empty state), kèm xử lý lỗi 401/403/422.
---

# Frontend API Integration

## Đầu vào
`docs/openapi.yaml` (hợp đồng), `docs/PRD.md` (thông báo lỗi chuẩn trong Scenario).

## Quy trình
1. Tạo một lớp gọi API trung tâm (`services/api/`): địa chỉ gốc từ biến môi trường, gắn token,
   timeout, chuẩn hóa lỗi về dạng `{ code, message, details }`. Kiểu dữ liệu sinh hoặc viết
   theo OpenAPI, không dùng `any`.
2. Mỗi màn hình lấy dữ liệu phải xử lý đủ ba trạng thái:
   - **Loading:** skeleton hoặc spinner; khóa nút gửi để tránh bấm trùng.
   - **Error:** thông báo dễ hiểu kèm nút "Thử lại" (Fallback UI), không để trang trắng.
   - **Success:** hiển thị dữ liệu; nếu danh sách rỗng thì **Empty state** có lời giải thích
     và hành động gợi ý (ví dụ "Chưa có khóa học, hãy nhập mã để tham gia").
3. Ánh xạ mã lỗi:
   | Mã | Hành vi |
   |---|---|
   | 401 | Xóa phiên, chuyển về trang đăng nhập |
   | 403 | Trang "Không có quyền truy cập" |
   | 404 | Trang hoặc thông báo "Không tìm thấy" |
   | 409 / 422 | Hiển thị lỗi theo từng trường trong biểu mẫu |
   | 5xx / mất mạng | Fallback UI và cho thử lại |
4. Thông báo lỗi hiển thị lấy đúng nội dung trong PRD, không tự bịa.
5. Thao tác ghi (nộp bài, thi): chống gửi trùng, xác nhận kết quả, cập nhật lại dữ liệu liên quan.
   Với bài thi: tự lưu đáp án định kỳ và xử lý mất kết nối.
6. Không để lộ token trong URL hoặc log.

## Đầu ra
Lớp API, các hook hoặc hàm gọi theo từng endpoint, và danh sách màn hình đã xử lý đủ 3 trạng thái.
