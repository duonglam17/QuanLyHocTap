# Thư mục Hợp đồng Giao tiếp giữa các Module (Inter-Module Contracts)

Thư mục này định nghĩa các quy tắc và hợp đồng giao tiếp giữa 3 module nghiệp vụ (`m1-core`, `m2-assessment`, `m3-quiz`) trong hệ thống Modular Monolith.

---

## 1. Nguyên tắc Bắt buộc (Architecture Rules)

Theo quy định kiến trúc trong `docs/architecture.md` và `docs/WORKFLOW.md`:

1. **Giao tiếp Độc quyền qua Service:**
   - Module này muốn lấy dữ liệu hoặc gọi logic của module khác **BẮT BUỘC** phải gọi thông qua **Service Interface** công khai của module đó hoặc qua các Contract được định nghĩa trong thư mục này.
   - **TUYỆT ĐỐI CẤM:**
     - Không import trực tiếp `controllers/`, `repositories/`, `models/` của module khác.
     - Không thực hiện câu lệnh SQL truy vấn trực tiếp vào bảng cơ sở dữ liệu thuộc sở hữu của module khác.

2. **Một chiều Phụ thuộc & Chống vòng tròn:**
   - Chiều phụ thuộc phải là một chiều (`UI -> Controller -> Service -> Repository -> Model/Database`).
   - Cấm mọi hình thức phụ thuộc vòng tròn (Circular Dependency) giữa các module:
     - Ví dụ: M2 gọi M3 thì M3 không được gọi ngược lại M2.
   - Nếu cần chia sẻ kiểu dữ liệu, DTO hoặc sự kiện chung, hãy khai báo vào thư mục `contracts/` này.

---

## 2. Các Luồng Giao tiếp Liên Module Dự kiến

### A. Bảng điểm (M2) $\rightarrow$ Điểm thi Trắc nghiệm (M3)
- **Bối cảnh:** Khi Giảng viên hoặc Sinh viên xem bảng điểm trong Module M2 (`US-13`, `US-14`), M2 cần tổng hợp cả điểm bài tập tự luận (thuộc M2) và điểm các bài thi trắc nghiệm (thuộc M3).
- **Hợp đồng:** `GradebookService` (M2) gọi trực tiếp `QuizResultService` (M3) thông qua phương thức chuẩn:
  ```js
  // m2-assessment/services/gradebookService.js
  const quizResultService = require('../../modules/m3-quiz/services/quizResultService');
  const quizScores = await quizResultService.getStudentQuizGrades(courseId, studentId);
  ```

### B. Kiểm tra Quyền thành viên (M2, M3) $\rightarrow$ Ghi danh Khóa học (M1)
- **Bối cảnh:** Trước khi cho phép sinh viên nộp bài tập (M2) hoặc bắt đầu làm bài thi trắc nghiệm (M3), hệ thống phải kiểm tra sinh viên đã ghi danh vào khóa học hay chưa.
- **Hợp đồng:** Gọi `CourseService.validateEnrollment(courseId, studentId)` của Module M1.

---

## 3. Quy trình Thêm Hợp đồng Mới
Mọi thay đổi hoặc bổ sung interface trong thư mục `contracts/` phải được các thành viên phụ trách các module liên quan thảo luận và thống nhất trước khi áp dụng.

