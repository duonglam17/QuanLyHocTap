---
name: codebase-graph-management
description: Vai trò Codebase Graph Management. Dùng để kiểm soát đồ thị phụ thuộc (dependency graph), ngăn import vòng tròn và vi phạm chiều phụ thuộc giữa các lớp/module; thiết lập công cụ kiểm tra như dependency-cruiser, madge, import-linter hoặc deptrac.
---

# Codebase Graph Management

## Mục tiêu
Giữ kiến trúc không bị vỡ khi AI sinh code nhanh: không import vòng tròn, không phụ thuộc ngược chiều.

## Quy tắc phụ thuộc (lấy từ docs/architecture.md)
- Cho phép: `controller -> service -> repository -> model`.
- Cấm: lớp dưới import lớp trên; controller import repository; repository import service;
  module này import trực tiếp repository hoặc model của module khác.
- Cấm mọi vòng phụ thuộc (A import B, B import A, kể cả gián tiếp).

## Quy trình
1. Xác định ngôn ngữ của dự án, chọn công cụ:
   | Ngôn ngữ | Công cụ |
   |---|---|
   | JavaScript/TypeScript | dependency-cruiser (chính), madge |
   | Python | import-linter |
   | PHP | deptrac |
   | Java | ArchUnit |
2. Cài công cụ và tạo tệp cấu hình mô tả đúng quy tắc phụ thuộc ở trên.
   Với JS/TS, ví dụ `.dependency-cruiser.js`:
   ```js
   module.exports = {
     forbidden: [
       { name: "no-circular", severity: "error", from: {}, to: { circular: true } },
       { name: "controller-no-repository", severity: "error",
         from: { path: "^src/.*/controllers" }, to: { path: "^src/.*/repositories" } },
       { name: "lower-not-import-upper", severity: "error",
         from: { path: "^src/.*/(repositories|models)" },
         to: { path: "^src/.*/(services|controllers)" } }
     ]
   };
   ```
3. Thêm lệnh vào `package.json` hoặc tài liệu: `deps:check` (kiểm tra), `deps:graph` (xuất đồ thị).
4. Chạy kiểm tra: sau mỗi module mới và trước mỗi lần commit.
5. Khi có vi phạm: nêu tệp, dòng, quy tắc bị phá, và đề xuất cách sửa
   (tách interface, chuyển logic xuống Service, đảo phụ thuộc). Sửa xong chạy lại đến khi sạch.
6. Nếu có công cụ dựng đồ thị mã nguồn (ví dụ Graphify), dùng để xuất đồ thị và đưa
   vào `docs/dependency-graph.md`.

## Đầu ra
Tệp cấu hình công cụ, lệnh chạy, `docs/dependency-graph.md` (đồ thị và kết quả kiểm tra gần nhất).
