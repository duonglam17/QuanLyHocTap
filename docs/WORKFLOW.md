# Quy trình làm việc nhóm (3 người)

## 1. Phân vai
| | Module | Hạ tầng giữ | Người duyệt PR |
|---|---|---|---|
| A | M1: Tài khoản, Khóa học, Tài liệu, Lịch học | backend/src/common, docker-compose, .env.example | C |
| B | M2: Bài tập, Chấm bài, Bảng điểm | frontend/src/shared, frontend/src/app, .github, CI | A |
| C | M3: Trắc nghiệm, Thông báo, Thảo luận | (không) | B |

Mỗi file chỉ có một chủ. Muốn sửa file của người khác: nhắn cho họ, hoặc mở PR nhỏ riêng và gọi họ duyệt.

## 2. Nhánh
- `main` luôn chạy được, không ai push trực tiếp.
- Đặt tên: `feat/m2-nop-bai`, `fix/m3-hen-gio`, `chore/...`, `docs/...`.
- Mỗi nhánh sống tối đa 1-2 ngày, PR nhỏ, merge ít nhất mỗi ngày.
- Merge bằng **Squash and merge**.

## 3. Mỗi buổi làm việc
```powershell
git switch main
git pull
git switch -c feat/m2-nop-bai        # nhánh mới; hoặc quay lại nhánh cũ rồi chạy 2 lệnh dưới
git fetch origin
git rebase origin/main
```

Trước khi commit, chỉ add đường dẫn của mình rồi kiểm tra:
```powershell
git add backend/src/modules/m2-assessment frontend/src/modules/m2 tests/m2
git status
git diff --cached --stat
git commit -m "feat(m2): nop bai tap dung han va tre han"
git push -u origin HEAD
```
Sau khi rebase mà phải đẩy lại nhánh của mình: `git push --force-with-lease`.

## 4. Commit message
`loại(module): mô tả ngắn`, loại gồm feat, fix, docs, test, refactor, chore.

## 5. Vùng chung và thay đổi
- Thêm thư viện (package.json, lockfile): PR nhỏ riêng, merge ngay, báo nhóm rebase.
- `backend/src/contracts/`: thay đổi phải có người liên quan đồng ý.
- Migration: file mới có tiền tố ngày và module, ví dụ `202611010900_m2_create_assignment.sql`. Không sửa migration đã merge, muốn đổi thì thêm migration mới.
- `docs/PRD.md`: chỉ đọc. Muốn đổi thì mở Issue, cả nhóm đồng ý.

## 6. Khi có conflict
```powershell
git fetch origin
git rebase origin/main
# mở file trong VS Code, dùng Merge Editor, chọn nội dung đúng
git add <file>
git rebase --continue
```
Riêng `package-lock.json` đừng sửa tay:
```powershell
git checkout origin/main -- package-lock.json
npm install
git add package-lock.json
```
Conflict về logic: người sở hữu file quyết định, hai bên nói chuyện trực tiếp.

## 7. Ngày tích hợp
Mỗi tuần một ngày (đề xuất thứ Sáu): mọi nhánh đã merge, chạy toàn bộ test, `main` phải chạy được.
