# Quy tac du an LMS Mini

## Phạm vi sửa file (BẮT BUỘC, áp dụng cho mọi phiên làm việc)
- Chỉ sửa trong các thư mục của module được người dùng nêu ở đầu phiên (M1, M2 hoặc M3).
- KHÔNG sửa các vùng sau, dù lý do gì:
  backend/src/common, backend/src/app.js, backend/src/contracts, frontend/src/shared, frontend/src/app,
  .github, docs/PRD.md, docs/flows.md, docs/openapi.yaml (file gốc), package.json, package-lock.json,
  docker-compose.yml, .env.example, database/migrations đã có, và thư mục của module khác.
- Cần thay đổi ở vùng cấm: DỪNG, mô tả đề xuất và lý do, KHÔNG tự sửa.
- Cần thêm thư viện: nêu tên và lý do, chờ người dùng đồng ý.
- Migration mới: tạo file mới theo mẫu YYYYMMDDHHMM_<m1|m2|m3>_<mô tả>.sql, không sửa file cũ.
- Không tạo tệp ngoài phạm vi; không đổi tên hay di chuyển file hàng loạt.
- Cuối mỗi lượt làm: liệt kê TOÀN BỘ file đã tạo hoặc sửa để người dùng đối chiếu với `git diff --stat`.
- Ngoại lệ: nếu prompt của người dùng có khối "NGOẠI LỆ CHỈ CÓ HIỆU LỰC TRONG PHIÊN NÀY", hãy làm theo
  phạm vi ngoại lệ đó cho phiên hiện tại. Mọi phiên khác vẫn áp dụng các quy tắc ở trên.