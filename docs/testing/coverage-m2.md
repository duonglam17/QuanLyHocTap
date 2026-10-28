# Báo cáo độ bao phủ kiểm thử M2

Ngày đo: 2026-10-29. Phạm vi: backend `m2-assessment` và các trang frontend M2
đang có test. Báo cáo coverage mô tả các nhánh được thực thi, không thay thế
đánh giá chất lượng assertion.

## Cách đo và kết quả

### Backend (Node.js Test Runner)

Backend dùng coverage tích hợp trong Node.js, không thêm dependency:

```powershell
cd backend
node --experimental-test-coverage --test tests/m2/assignment.test.js tests/m2/submission.test.js tests/m2/grade.test.js tests/m2/studentGradebook.test.js tests/m2/classGradebook.test.js tests/m2/assessmentUsage.db.test.js
```

Kết quả: **58 test, 57 đạt, 1 bỏ qua, 0 lỗi**. Test CSDL (`assessmentUsage.db.test.js`) bị bỏ qua vì chưa
cấu hình `M2_TEST_DB_NAME` trỏ tới CSDL test riêng có tên kết thúc bằng `_test`.
Phần trăm hiển thị là line / branch / function coverage của từng file do Node
ghi nhận khi chạy bộ test M2; không gộp hoặc lấy trung bình các phần trăm khác
nhau.

| Tầng | Tệp | Line % | Branch % | Function % |
|---|---|---:|---:|---:|
| Service | `assignmentService.js` | 87.68 | 73.11 | 100.00 |
| Service | `submissionService.js` | 92.06 | 83.93 | 85.71 |
| Service | `gradeService.js` | 84.06 | 64.15 | 100.00 |
| Service | `classGradebookService.js` | 90.41 | 71.43 | 100.00 |
| Service | `studentGradebookService.js` | 90.00 | 70.59 | 100.00 |
| Controller | `assignmentController.js` | 94.81 | 40.63 | 100.00 |
| Controller | `submissionController.js` | 95.24 | 38.46 | 100.00 |
| Controller | `gradeController.js` | 79.45 | 63.64 | 83.33 |
| Controller | `classGradebookController.js` | 79.17 | 71.43 | 80.00 |
| Controller | `studentGradebookController.js` | 90.91 | 66.67 | 100.00 |
| Repository | `studentGradebookRepository.js` | 95.83 | 70.00 | 75.00 |
| Repository | `classGradebookRepository.js` | 75.00 | 83.33 | 66.67 |
| Repository | `gradebookRepository.js` | 74.36 | 100.00 | 66.67 |
| Repository | `submissionRepository.js` | 65.55 | 60.00 | 33.33 |
| Repository | `gradeRepository.js` | 62.26 | 75.00 | 50.00 |
| Repository | `assignmentRepository.js` | 46.12 | 44.44 | 37.50 |
| Routes | `assignmentRoutes.js` | 100.00 | 100.00 | 100.00 |
| Routes | `classGradebookRoutes.js` | 100.00 | 100.00 | 100.00 |
| Routes | `gradeRoutes.js` | 100.00 | 100.00 | 100.00 |
| Routes | `studentGradebookRoutes.js` | 100.00 | 100.00 | 100.00 |
| Routes | `submissionRoutes.js` | 93.85 | 88.89 | 100.00 |
| Utils | `csv.js` | 100.00 | 100.00 | 100.00 |
| Utils | `sanitizer.js` | 93.55 | 66.67 | 100.00 |
| Toàn bộ M2 | (Tất cả tệp M2) | **75.71** | **71.10** | **74.63** |

### Frontend (Vitest v8 Coverage)

Sau khi được người dùng chấp thuận thêm `@vitest/coverage-v8` (dev dependency
tương thích Vitest 2), đo coverage các trang M2 bằng:

```powershell
cd frontend
npx vitest run src/modules/m2 --coverage --coverage.reporter=text --coverage.include=src/modules/m2/pages/*.jsx
```

Kết quả: **7 test files, 69 test đạt, 0 lỗi**. Coverage theo trang (statement / branch /
function / line):

| Trang | Statement % | Branch % | Function % | Line % |
|---|---:|---:|---:|---:|
| `AssignmentSubmissionPage.jsx` | 99.36 | 92.85 | 87.50 | 99.36 |
| `ClassGradebookPage.jsx` | 100.00 | 86.36 | 100.00 | 100.00 |
| `CourseAssignmentsPage.jsx` | 100.00 | 100.00 | 100.00 | 100.00 |
| `MyGradesPage.jsx` | 100.00 | 83.33 | 100.00 | 100.00 |
| `SubmissionGradingPage.jsx` | 94.92 | 78.37 | 73.33 | 94.92 |
| **Tổng các trang M2** | **97.70** | **84.56** | **86.11** | **97.70** |

Các test component M2 hiện có: `AssignmentTab` 12 test; component này không nằm
trong phạm vi trang (`pages/*.jsx`) của bảng coverage trên. Cài provider làm
`npm install` báo 9 lỗ hổng dependency trong cây hiện tại (5 moderate, 1 high,
3 critical); không chạy `npm audit fix` và không tự nâng cấp các gói khác.

## Nhánh quan trọng chưa được bao phủ đầy đủ

- **Tích hợp MySQL thật (Database Integration):** `assessmentUsage.db.test.js` và các hàm Repository thuần MySQL (`assignmentRepository.js`, `gradeRepository.js`) chưa chạy integration với MySQL thật vì cần biến môi trường `M2_TEST_DB_NAME` trỏ tới cơ sở dữ liệu test riêng kết thúc bằng `_test`. Các luồng nghiệp vụ hiện tại được bao phủ đầy đủ qua transaction mocks và query statements verification.
- **Xử lý luồng lỗi tệp storage (I/O streaming & cleanup):** Các nhánh I/O lỗi thấp (ví dụ: mất kết nối khi stream tệp lớn qua supertest, tệp hỏng giữa chừng trên đĩa cứng) đã có bọc try/catch và log lỗi, nhưng chưa giả lập lỗi phần cứng I/O trong unit test.
- **Frontend non-critical fallback branches:** Nhánh lỗi mạng hiếm gặp khi fetch song song các dropdown khóa học hoặc đường dẫn Splat route ngoài dự kiến (line 60 trong `MyGradesPage.jsx`, lines 126-127 trong `ClassGradebookPage.jsx`).

## Lỗi phát hiện và xử lý

| ID | Mức độ | Vị trí | Mô tả | Cách tái hiện | Kết quả |
|---|---|---|---|---|---|
| M2-01 | Trung bình | `backend/src/modules/m2-assessment/services/assignmentService.js` — `updateAssignment` | Hàm lấy bài tập bằng `getAssignmentById(assignmentId)` nhưng không truyền người dùng/role. Hàm kiểm tra chi tiết từ chối role vắng mặt, khiến cả chủ khóa hợp lệ nhận 403 khi sửa bài tập. | Gọi `updateAssignment` với ID bài tập hiện có, instructor ID là chủ khóa và một thay đổi hợp lệ. Trước khi sửa, hàm ném `ForbiddenError` trước khi vào transaction. | Đã sửa: truyền danh tính `GIANG_VIEN` vào kiểm tra quyền; bỏ lần kiểm tra chủ khóa lặp lại. Test hồi quy xác nhận cập nhật/sanitize thành công và người không sở hữu không thể ghi. |
| M2-02 | Trung bình | `backend/src/modules/m2-assessment/index.js` — khai báo `init` | Có hai khai báo hàm `init` giống nhau; ESLint báo `Identifier 'init' has already been declared` và dừng lint backend. | Chạy `npm run lint` trong `backend`. | Đã xóa khai báo lặp. Test hiện có `M2 init registers the assessmentUsage Port` tiếp tục xác nhận init đăng ký đúng Port. |

Không phát hiện lỗi bổ sung ngoài M2 trong phạm vi kiểm tra coverage này. Test
MySQL integration chưa chạy; đây là giới hạn môi trường, không phải kết quả
pass của tích hợp CSDL.

## Xác minh sau thay đổi

- `npm run lint` trong `backend`: đạt (0 lỗi, 0 cảnh báo).
- `npm run lint` trong `frontend`: đạt (0 lỗi, 0 cảnh báo).
- `node --test --test-force-exit tests/**/*.test.js` trong `backend`: **182 test, 181 đạt, 1 bỏ qua, 0 lỗi**.
- `npm test` trong `frontend`: **37 test files, 230 test đạt, 0 lỗi**.
- Bộ test coverage M2 backend: **58 test, 57 đạt, 1 bỏ qua, 0 lỗi**.
- Bộ test coverage M2 frontend: **7 test files, 69 test đạt, 0 lỗi**.
