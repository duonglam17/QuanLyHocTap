---
name: api-contract
description: Vai trò API Contract. Dùng khi cần thiết kế hoặc sinh tài liệu Swagger/OpenAPI (docs/openapi.yaml) từ PRD và sơ đồ tuần tự, làm hợp đồng giữa backend và frontend, và gắn Swagger UI vào backend.
---

# API Contract (OpenAPI)

## Đầu vào
`docs/PRD.md`, `docs/database.md`, `docs/diagrams/sequence.puml`, mã nguồn controller nếu đã có.

## Quy trình
1. Liệt kê endpoint cho mỗi User Story (mỗi endpoint ghi `x-user-story: US-xx`).
2. Viết `docs/openapi.yaml` theo OpenAPI 3.x, gồm:
   - `info`, `servers`, `tags` theo module;
   - `components/schemas` dùng lại được (User, Course, Assignment, Submission, Quiz...);
   - `components/securitySchemes` (bearer token) và `security` cho từng endpoint;
   - mỗi endpoint: tóm tắt, tham số, request body, mọi response (200/201/400/401/403/404/409/422)
     kèm ví dụ (example) thực tế.
3. Quy ước:
   - REST theo danh từ số nhiều, tiền tố phiên bản `/api/v1`;
   - danh sách có phân trang (`page`, `limit`) và sắp xếp;
   - lỗi thống nhất: `{ "code": "...", "message": "...", "details": [...] }`,
     thông báo lấy đúng từ Scenario Gherkin trong PRD;
   - ghi rõ vai trò được phép gọi từng endpoint (Admin, Giảng viên, Sinh viên).
4. Gắn Swagger UI vào backend tại `/api-docs` (đọc từ `openapi.yaml`).
5. Đồng bộ hai chiều: khi sửa controller phải sửa hợp đồng và ngược lại; liệt kê chỗ lệch nếu có.

## Kiểm tra
- Lint hợp đồng bằng công cụ (ví dụ Spectral: `npx @stoplight/spectral-cli lint docs/openapi.yaml`).
- Mỗi User Story Must có ít nhất một endpoint; không có endpoint thừa không thuộc story nào.

## Đầu ra
`docs/openapi.yaml`, cấu hình Swagger UI, và danh sách endpoint theo User Story.
