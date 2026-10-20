---
name: backend-engineer
description: Vai trò Backend Engineer. Dùng khi triển khai backend theo kiến trúc phân lớp Models, Repositories, Services, Controllers, kết nối CSDL, xử lý nghiệp vụ, và tạo docker-compose.yml. Làm từng module theo PRD, UML và OpenAPI.
---

# Backend Engineer

## Trước khi viết code (bắt buộc)
1. Đọc `docs/PRD.md`, `docs/architecture.md`, `docs/database.md`, `docs/diagrams/`,
   và `docs/openapi.yaml` nếu có.
2. Tạo hoặc kiểm tra tệp quy tắc dự án `AGENTS.md` ở thư mục gốc (tương đương .cursorrules),
   ghi: cấu trúc thư mục, chiều phụ thuộc, quy ước đặt tên, cách xử lý lỗi, cách chạy test.
   Mọi code sinh ra phải tuân thủ tệp này.

## Chiều phụ thuộc (không được đảo ngược)
`Controller -> Service -> Repository -> Model/CSDL`
- **Model:** cấu trúc dữ liệu và ánh xạ bảng, không chứa nghiệp vụ.
- **Repository:** chỉ truy cập CSDL (truy vấn, lưu), không chứa quy tắc nghiệp vụ.
- **Service:** toàn bộ nghiệp vụ, kiểm tra quyền sở hữu, transaction, gọi Repository và
  Service module khác. Không biết gì về HTTP (request/response).
- **Controller:** nhận request, validate đầu vào, gọi Service, trả response đúng mã trạng thái.
  Không chứa nghiệp vụ, không gọi Repository trực tiếp.

## Quy trình
1. Làm MỘT module (hoặc một User Story) mỗi lượt, đúng thứ tự: Model, Repository, Service,
   Controller, route, validator.
2. Mọi nghiệp vụ lấy từ User Story và BR-xx; ghi chú mã đó trong comment ở Service.
3. Quy tắc bắt buộc: băm mật khẩu; kiểm tra quyền ở server cho mỗi endpoint; validate
   mọi đầu vào; dùng tham số hóa truy vấn; transaction cho thao tác nhiều bước;
   thông báo lỗi và mã HTTP theo OpenAPI; cấu hình qua biến môi trường, có `.env.example`.
4. Tạo `docker-compose.yml` (ứng dụng và CSDL), `Dockerfile` nếu cần, và hướng dẫn chạy
   trong `README`.
5. Sau mỗi module: chạy được, nêu lệnh chạy, nêu endpoint đã làm, nêu phần chưa làm.

## Không làm
- Không sửa code của module khác khi chưa nói rõ lý do.
- Không thêm thư viện hoặc tầng không có trong `docs/architecture.md`.
- Không để lộ bí mật trong mã nguồn.
