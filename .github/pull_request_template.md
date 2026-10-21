## Mô tả
<!-- Làm gì, vì sao. Liên kết User Story: US-xx, BR-xx, EC-xx -->

## Module
- [ ] M1 (Nền tảng, Khóa học)
- [ ] M2 (Bài tập, Bảng điểm)
- [ ] M3 (Trắc nghiệm, Tương tác)
- [ ] Hạ tầng / tài liệu

## Kiểm tra trước khi xin duyệt
- [ ] Chỉ sửa file trong vùng của mình (xem `git diff --stat`)
- [ ] Không sửa vùng cấm: common, shared, app, .github, docs/PRD.md, package.json, docker-compose.yml, thư mục module khác
- [ ] Đã `git rebase origin/main` và không còn conflict
- [ ] Đã chạy test và chạy thử tính năng, kết quả đúng
- [ ] Không commit `.env`, khóa bí mật, log, file sinh tự động
- [ ] Migration mới là file mới, không sửa migration đã merge
- [ ] Nếu đổi `contracts/` hoặc OpenAPI: đã báo người liên quan
- [ ] Nếu thêm thư viện: đã nêu lý do bên dưới

## Ảnh chụp / kết quả chạy thử
<!-- Giao diện: ảnh. API: ví dụ request và response -->

## Ghi chú cho người duyệt
