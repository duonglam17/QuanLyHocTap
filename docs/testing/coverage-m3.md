# Báo cáo coverage M3

## Phạm vi và cách chạy

Coverage đo trên source của `backend/src/modules/m3-quiz` và `frontend/src/modules/m3`. Coverage là tín hiệu định hướng, không phải ngưỡng chất lượng; không hạ ngưỡng hay bỏ qua test.

Backend, chạy từ thư mục gốc bằng PowerShell:

```powershell
Set-Location backend
$tests = Get-ChildItem tests\m3 -Filter '*.test.js' | ForEach-Object { $_.FullName }
node --test --test-force-exit --experimental-test-coverage --test-coverage-include='src/modules/m3-quiz/**/*.js' $tests
```

Kết quả M3: **92 test, 91 passed, 1 skipped, 0 failed**. Tổng coverage: **81.80% lines, 77.21% branches, 70.31% functions**.

Frontend, chạy từ thư mục gốc bằng PowerShell:

```powershell
Set-Location frontend
npm test -- --coverage --coverage.include='src/modules/m3/**/*.{js,jsx}' --coverage.reporter=text
```

Kết quả toàn bộ frontend: **37 test files, 312 passed**. Tổng coverage M3: **91.96% lines, 86.69% branches, 83.84% functions**. Lệnh cần provider `@vitest/coverage-v8` đã khai báo sẵn trong manifest; provider bị thiếu trong `node_modules` nên đã khôi phục bằng cài đặt không lưu manifest/lockfile. Không thêm thư viện.

## Coverage backend theo Service và Controller

Tỷ lệ dưới đây là line/branch coverage theo từng file.

| Loại | File | Lines | Branches | Ghi chú |
|---|---|---:|---:|---|
| Service | `announcementService.js` | 89.15% | 74.19% | Một số nhánh lỗi/Port và xử lý dữ liệu biên chưa được kích hoạt. |
| Service | `attemptService.js` | 90.59% | 79.51% | Đã thêm kiểm thử tranh chấp takeover; còn nhánh lỗi DB/Port và một số trường hợp hiếm. |
| Service | `discussionService.js` | 88.75% | 79.55% | Các nhánh kiểm tra quyền, sanitize và luồng chính đã có test; còn các nhánh dữ liệu/Port biên. |
| Service | `notificationService.js` | 79.05% | 41.67% | Còn nhánh thiếu Port, lỗi persist và best-effort/logging chưa được kích hoạt đầy đủ. |
| Service | `quizService.js` | 84.57% | 73.85% | Còn các nhánh update/delete và một số validation/Port biên. |
| Controller | `announcementController.js` | 47.50% | 100.00% | Chưa gọi trực tiếp đủ ba handler create/list/delete qua test controller. |
| Controller | `attemptController.js` | 93.62% | 72.73% | Còn một số nhánh response/error mapping. |
| Controller | `discussionController.js` | 100.00% | 100.00% | Đã phủ. |
| Controller | `notificationController.js` | 100.00% | 100.00% | Đã phủ. |
| Controller | `quizController.js` | 85.07% | 100.00% | Một số handler create/update/delete chưa được gọi trực tiếp. |

## Coverage frontend theo trang

Tỷ lệ dưới đây là line/branch coverage theo từng trang.

| Trang | Lines | Branches | Ghi chú |
|---|---:|---:|---|
| `M3PlaceholderPage.jsx` | 25.00% | 100.00% | Trang khung chỉ bọc `PageTemplate`, không chứa nghiệp vụ M3. |
| `NotificationsPage.jsx` | 100.00% | 88.88% | Đã thêm test không hiển thị link có scheme không an toàn. |
| `QuizRoomPage.jsx` | 92.42% | 85.71% | Đã thêm test chặn nộp khi đáp án chưa lưu và kiểm tra ranh giới cảnh báo giờ thi. |
| `ResultPage.jsx` | 100.00% | 95.65% | Điểm `null` được xác nhận hiển thị “Chưa có”. |

Một số phần liên quan để định hướng bổ sung: `QuizTab.jsx` đạt 85.91% lines / 80.95% branches; `NotificationBell.jsx` đạt 90.00% / 88.23%; nhóm pages đạt 93.02% / 86.91%.

## Nhánh quan trọng chưa được bao phủ và lý do

- **SQL repository cần kiểm chứng bằng MySQL thật:** `attemptRepository.js` đạt 44.22% lines, `announcementRepository.js` 57.58%, `notificationRepository.js` 50.54%, `quizRepository.js` 77.78%. Test API/repository `m3.api.db.test.js` bị skip vì chưa cấu hình `M3_TEST_DB_NAME`; các query path còn lại không được xác nhận với CSDL thật. Cần cấu hình CSDL riêng có tên kết thúc `_test`, rồi chạy suite này; không dùng DB phát triển.
- **Controller create/update/delete chưa đủ lượt gọi:** `announcementController.js` và một phần `quizController.js`. Đây chủ yếu là lớp chuyển tiếp request/service; các route/service cốt lõi đã có unit/API test, nhưng cần bổ sung test handler nếu cần kiểm tra đầy đủ response mapping.
- **Các nhánh lỗi hiếm của service:** `notificationService` còn branch coverage thấp do các trường hợp Port thiếu/lỗi persist và logging best-effort; các service khác còn lỗi Port/DB, dữ liệu rỗng hoặc nhánh update/delete ít gặp. Không thấy lỗi nghiệp vụ trong các nhánh đã chạy; phần chưa chạy cần test riêng nếu thay đổi các luồng này.
- **`QuizTab.jsx`:** còn nhánh lưu metadata thành công nhưng lưu câu hỏi thất bại, lỗi lấy chi tiết đề khi chỉnh sửa, và một số nhánh validation/editor chưa đi qua toàn bộ biến thể. Tình huống lưu từng phần cần được kiểm tra khi sửa luồng lưu đề.
- **`QuizRoomPage.jsx`:** còn nhánh xử lý retry/unmount và một số nhánh đồng bộ trạng thái trong lúc request đang chạy. Test hiện có kiểm tra takeover, phiên bị thay, lỗi lưu/nộp, offline queue, tự nộp và timer; nhánh chưa phủ cần ưu tiên khi thay đổi cơ chế đồng bộ phiên hoặc hàng đợi.
- **`NotificationBell.jsx`:** còn trạng thái lỗi khi refetch sau khi đã có dữ liệu và một số đường refresh theo visibility/timer. Đây là trạng thái phục hồi nền; cần test bổ sung khi thay đổi refresh/cache.
- **`M3PlaceholderPage.jsx`:** coverage thấp do chỉ dựng trang mẫu dùng chung, không có nhánh nghiệp vụ riêng; không ưu tiên tăng coverage chỉ để tăng tỷ lệ.

## Test bổ sung trong T4

- Backend: kiểm tra kết quả khi atomic takeover thua tranh chấp — chỉ resume nếu tab yêu cầu đã thắng; nếu tab khác thắng thì trả 409 không kèm câu hỏi/đáp án; nếu giới hạn takeover vừa đạt thì trả 409 phù hợp.
- Frontend: xác nhận không nộp bài khi còn đáp án chờ lưu mà offline; link thông báo có đích `javascript:` không được render; kiểm tra ranh giới 60/61 và 300/301 giây của cảnh báo giờ thi.
- Không phát hiện lỗi trong mã nguồn module cần sửa ở các test đã chạy; T4 chỉ thay đổi test và báo cáo.

## Kiểm thử toàn bộ sau T4

- Backend: `node --test --test-force-exit --test-timeout=30000 tests/**/*.test.js` — **212 test, 209 passed, 3 skipped, 0 failed**. Dùng Node test runner trực tiếp với cùng toàn bộ test glob và chế độ force-exit vì `npm test` đặt các tham số bổ sung sau glob, không áp dụng được để kết thúc tiến trình cron trong khung test.
- Frontend: `npm test` — **37 test files, 312 passed**.
- Ba test backend bị skip là integration suite MySQL của M1, M2 và M3 do chưa cấu hình các biến DB riêng. Riêng `tests/m3/m3.api.db.test.js` cần `M3_TEST_DB_NAME` riêng hậu tố `_test` như hướng dẫn tại [test-matrix-m3.md](./test-matrix-m3.md).
