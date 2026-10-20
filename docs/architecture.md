# TÀI LIỆU KIẾN TRÚC HỆ THỐNG (SYSTEM ARCHITECTURE) - LMS MINI

---

## 1. Tổng quan và Phong cách Kiến trúc

### 1.1. Bối cảnh và Định hướng
Dự án **LMS Mini** được phát triển bởi nhóm 3 sinh viên trong thời gian 1-2 tháng, mục tiêu là xây dựng một nền tảng quản lý học tập gọn nhẹ, tin cậy, an toàn và dễ bảo trì. Dựa trên các ràng buộc về nguồn lực và thời gian, phong cách kiến trúc được lựa chọn là **Modular Monolith** kết hợp với các nguyên lý của **Clean Architecture (Layered Architecture)**.

### 1.2. Lý do chọn Modular Monolith
1. **Tinh gọn trong triển khai & vận hành:** Không phát sinh chi phí hạ tầng, độ trễ mạng (network latency) hay sự phức tạp của distributed transactions như kiến trúc Microservices.
2. **Ranh giới module rõ ràng:** Phân tách mã nguồn thành 3 module nghiệp vụ độc lập tương ứng với 3 thành viên trong nhóm, giảm thiểu xung đột Git và phụ thuộc chéo.
3. **Tuân thủ Clean Architecture:** Mỗi module phân tầng nghiêm ngặt (`Controller -> Service -> Repository`), đảm bảo logic nghiệp vụ được cô lập hoàn toàn khỏi framework và cơ sở dữ liệu.

---

## 2. Sơ đồ Khối Kiến trúc (Architectural Block Diagram)

```mermaid
flowchart TD
    subgraph ClientLayer["TẦNG TRÌNH DUYỆT (CLIENT LAYER)"]
        ReactApp["React SPA (Vite + Tailwind CSS + shadcn/ui)"]
    end

    subgraph APIGateway["TẦNG ĐIỀU HƯỚNG & BẢO VỆ (API & MIDDLEWARE)"]
        CORS["CORS & Helmet"]
        RateLimiter["Rate Limiting (express-rate-limit)"]
        AuthMiddleware["JWT Authentication & RBAC Middleware"]
    end

    subgraph ModularMonolith["TẦNG ỨNG DỤNG (MODULAR MONOLITH APPLICATION)"]
        subgraph M1["MODULE 1: NỀN TẢNG & KHÓA HỌC (E1, E2)"]
            M1_C["M1 Controllers<br/>(Auth, User, Course, Material, Schedule)"]
            M1_S["M1 Services<br/>(AuthService, UserService, CourseService, ScheduleService)"]
            M1_R["M1 Repositories<br/>(UserRepository, CourseRepository, ScheduleRepository)"]
        end

        subgraph M2["MODULE 2: BÀI TẬP & BẢNG ĐIỂM (E3, E5)"]
            M2_C["M2 Controllers<br/>(Assignment, Submission, Gradebook)"]
            M2_S["M2 Services<br/>(AssignmentService, SubmissionService, GradebookService)"]
            M2_R["M2 Repositories<br/>(AssignmentRepository, SubmissionRepository)"]
        end

        subgraph M3["MODULE 3: TRẮC NGHIỆM & TƯƠNG TÁC (E4, E6)"]
            M3_C["M3 Controllers<br/>(Quiz, Attempt, Announcement, Discussion)"]
            M3_S["M3 Services<br/>(QuizService, AttemptService, CommunicationService)"]
            M3_R["M3 Repositories<br/>(QuizRepository, AttemptRepository, CommRepository)"]
        end
    end

    subgraph InfrastructureLayer["TẦNG HẠ TẦNG & LƯU TRỮ (INFRASTRUCTURE LAYER)"]
        MySQL[("MySQL 8.0 Database<br/>(InnoDB, utf8mb4, Timezone +07:00)")]
        FileStorage[("Secure File Storage<br/>(Local Disk /app/uploads outside Web Root)")]
        CronWorker["Scheduled Task (Node-cron Worker<br/>Auto-submit & File Cleanup)"]
    end

    %% Client to Middleware
    ReactApp -->|HTTP/REST /api/...| CORS
    CORS --> RateLimiter
    RateLimiter --> AuthMiddleware

    %% Middleware to Controllers
    AuthMiddleware --> M1_C
    AuthMiddleware --> M2_C
    AuthMiddleware --> M3_C

    %% Layers inside Modules
    M1_C --> M1_S
    M1_S --> M1_R
    M1_R --> MySQL

    M2_C --> M2_S
    M2_S --> M2_R
    M2_R --> MySQL

    M3_C --> M3_S
    M3_S --> M3_R
    M3_R --> MySQL

    %% Inter-module communication (Service to Service ONLY)
    M2_S -.->|Gọi trực tiếp qua Service Interface<br/>getStudentQuizGrades(courseId, studentId)| M3_S
    M2_S -.->|Kiểm tra quyền thành viên<br/>validateEnrollment(courseId, studentId)| M1_S
    M3_S -.->|Kiểm tra quyền thành viên<br/>validateEnrollment(courseId, studentId)| M1_S

    %% File storage access
    M1_S -->|Lưu/Tải bài giảng| FileStorage
    M2_S -->|Lưu/Tải bài nộp| FileStorage

    %% Worker
    CronWorker -.->|Quét quá hạn thi & Orphan files| M3_S
    CronWorker -.->|Dọn tệp rác| FileStorage
```

---

## 3. Danh sách Module và Trách nhiệm (Module Responsibilities)

Hệ thống được chia thành 3 module nghiệp vụ khớp chính xác với phân công 3 thành viên trong PRD (Mục 10):

| Module | Tên Module & Phụ trách | Phạm vi Epics | Trách nhiệm chính |
|---|---|---|---|
| **M1** | **Nền tảng, Xác thực & Quản lý Khóa học**<br/>*(Sinh viên 1)* | **E1, E2** | - Quản lý tài khoản người dùng, phân quyền RBAC (Admin, Giảng viên, Sinh viên).<br/>- Cơ chế bảo mật: Khóa tài khoản tạm thời khi brute-force (BR-02), thu hồi token khi khóa tài khoản (US-02).<br/>- Quản lý khóa học, sinh và xác thực mã ghi danh (Enrollment Key).<br/>- Quản lý bài giảng và tải tài liệu an toàn (kiểm tra MIME/magic bytes, lưu UUID).<br/>- Quản lý thời khóa biểu và lịch học (US-17, US-18, BR-19, BR-20). |
| **M2** | **Bài tập Tự luận & Bảng điểm**<br/>*(Sinh viên 2)* | **E3, E5** | - Quản lý bài tập tự luận, kiểm soát deadline và cờ cho phép nộp trễ (BR-07).<br/>- Tiếp nhận bài nộp của sinh viên, chống double submit, xử lý nộp lại.<br/>- Giảng viên chấm điểm tự luận (thang điểm 10, bước nhảy 0.25) và trả nhận xét (BR-08).<br/>- Tổng hợp bảng điểm cá nhân và bảng điểm lớp học (gọi M3 Service để lấy điểm thi trắc nghiệm).<br/>- Xuất bảng điểm lớp ra file CSV an toàn (chống CSV Injection, UTF-8 BOM) (BR-16). |
| **M3** | **Đề thi Trắc nghiệm & Tương tác Lớp học**<br/>*(Sinh viên 3)* | **E4, E6** | - Quản lý đề thi trắc nghiệm, ngân hàng câu hỏi (Single-choice, 2-5 lựa chọn, BR-12).<br/>- Quản lý phiên làm bài thi (Attempt), đồng hồ đếm ngược căn theo server time (BR-14), auto-save đáp án.<br/>- Chấm điểm tự động và ghi nhận kết quả trong 1 Database Transaction duy nhất (NFR-08).<br/>- Cung cấp `QuizResultService` công khai để M2 gọi lấy điểm thi trắc nghiệm.<br/>- Bảng tin thông báo lớp học (US-15) và diễn đàn thảo luận bài học (US-16) kèm sanitize chống XSS (BR-18).<br/>- Quản lý thông báo hệ thống tự động (Notifications) cho bài tập mới/đổi lịch. |

---

## 4. Bảng Quy tắc Phụ thuộc (Dependency Rules)

Để bảo đảm tính toàn vẹn của kiến trúc Clean Architecture trong mô hình Modular Monolith, mọi thành viên bắt buộc phải tuân thủ nghiêm ngặt bảng quy tắc sau:

| Chiều phụ thuộc / Tương tác | Trạng thái | Quy tắc thực thi cụ thể |
|---|:---:|---|
| **Controller $\rightarrow$ Service (cùng module)** | **ĐƯỢC PHÉP** | Controller nhận request HTTP, validate dữ liệu đầu vào và gọi Service xử lý nghiệp vụ. |
| **Service $\rightarrow$ Repository (cùng module)** | **ĐƯỢC PHÉP** | Service thực hiện logic nghiệp vụ và gọi Repository để thao tác dữ liệu. |
| **Repository $\rightarrow$ Database** | **ĐƯỢC PHÉP** | Repository là lớp duy nhất được phép sinh câu lệnh SQL truy vấn vào database. |
| **Module A Service $\rightarrow$ Module B Service** | **ĐƯỢC PHÉP** | Giao tiếp giữa các module chỉ thông qua **Service Interface công khai**. Ví dụ: `GradebookService` (M2) gọi `QuizResultService.getStudentQuizGrades()` (M3). |
| **Controller $\rightarrow$ Repository** | **BỊ CẤM** | Controller không được phép vượt tầng gọi trực tiếp Repository. |
| **Module A $\rightarrow$ Repository của Module B** | **BỊ CẤM** | Tuyệt đối không được import hay gọi Repository của module khác. |
| **Module A $\rightarrow$ Bảng Database của Module B** | **BỊ CẤM** | Repository của module này không được thực hiện câu lệnh SELECT/UPDATE trực tiếp trên bảng dữ liệu riêng của module khác. |
| **Service $\rightarrow$ Controller** | **BỊ CẤM** | Chiều phụ thuộc ngược bị cấm hoàn toàn. |
| **Phụ thuộc vòng tròn (Circular Dependency)** | **BỊ CẤM** | Cấm thiết kế phụ thuộc tuần hoàn (ví dụ M1 gọi M2 và M2 lại gọi M1). Nếu cần dữ liệu chéo, dùng Service trung gian hoặc tách Interface. |

---

## 5. Danh mục Quyết định Kiến trúc (Architectural Decision Records - ADR)

### ADR-01: Phong cách Kiến trúc Modular Monolith trên Node.js + Express
- **Trạng thái:** Chấp thuận.
- **Bối cảnh:** Nhóm 3 người làm trong 1-2 tháng, cần tốc độ phát triển nhanh, kiểm soát lỗi tập trung, không phân mảnh hạ tầng.
- **Quyết định:** Sử dụng Node.js (v20 LTS) với Express.js, tổ chức theo mô hình Modular Monolith phân tầng (Layered). Mã nguồn backend phân chia thành các thư mục module riêng biệt (`modules/auth_course`, `modules/assignment_grade`, `modules/quiz_comm`).
- **Hệ quả:** Dễ dàng gộp chung vào 1 tiến trình chạy (1 process), chia sẻ database connection pool, nhưng vẫn đảm bảo tính độc lập giữa 3 thành viên.

### ADR-02: Cơ sở dữ liệu quan hệ MySQL 8.0 (InnoDB, utf8mb4)
- **Trạng thái:** Chấp thuận.
- **Bối cảnh:** Dữ liệu học tập có tính liên kết chặt chẽ (Khóa học, Sinh viên, Bài tập, Lượt thi), yêu cầu tính toàn vẹn (ACID transactions) cao khi nộp bài và chấm điểm.
- **Quyết định:** Chọn **MySQL 8.0**, Storage Engine **InnoDB**, Character Set **utf8mb4** và Collation **utf8mb4_unicode_ci**. Sử dụng thư viện `mysql2/promise` với Connection Pool (kích thước tối thiểu 10, tối đa 30 connections).
- **Hệ quả:** Đảm bảo toàn vẹn dữ liệu, hỗ trợ khóa dòng (row-level locking), database transactions và kiểm tra ràng buộc khóa ngoại chặt chẽ.

### ADR-03: Frontend Single Page Application (SPA) với React + Vite + Tailwind CSS + shadcn/ui
- **Trạng thái:** Chấp thuận.
- **Bối cảnh:** Giao diện cần tương tác mượt mà, phản hồi nhanh (làm bài thi trắc nghiệm đếm ngược, nộp bài tập, bảng điểm tương tác).
- **Quyết định:** Sử dụng React 18+ với Vite làm build tool, thư viện tạo kiểu Tailwind CSS kết hợp hệ thống component chuẩn shadcn/ui (Radix UI). Quản lý state bằng React Context / Zustand, gọi API bằng Axios với Interceptor xử lý JWT.
- **Hệ quả:** Phát triển UI nhanh, đồng bộ design system, không bị vỡ giao diện trên Desktop và Tablet.

### ADR-04: Chiến lược Xác thực JWT Kép + Token Version + Database Refresh Token
- **Trạng thái:** Chấp thuận.
- **Bối cảnh:** Yêu cầu bảo mật: Hạn chế lộ lọt token (EC-14), cho phép refresh token tự động, và đặc biệt đáp ứng yêu cầu **US-02: Khi Admin khóa tài khoản, MỌI phiên đăng nhập hiện tại phải bị vô hiệu hóa ngay lập tức**. JWT thuần stateless không làm được điều này.
- **Quyết định:**
  1. **Access Token (JWT):** Thời hạn ngắn (**15 phút**), chứa `user_id`, `role`, `token_version`.
  2. **Refresh Token:** Lưu trong bảng `refresh_tokens` trong database (thời hạn **7 ngày**, lưu dạng mã hóa hash).
  3. **Cơ chế Thu hồi Phiên (Session Invalidation):** Bảng `users` có cột `token_version INT DEFAULT 1`. Mỗi khi Admin khóa tài khoản (US-02), hoặc người dùng đăng xuất, hệ thống thực hiện `UPDATE users SET token_version = token_version + 1 WHERE id = ?` và xóa toàn bộ refresh token liên quan. Khi Middleware kiểm tra JWT, nếu `payload.token_version < user.token_version` thì từ chối ngay lập tức (HTTP 401).
- **Hệ quả:** Kết hợp được ưu điểm tốc độ của JWT và khả năng thu hồi tức thời của session tập trung.

### ADR-05: Lưu trữ và Phân phối Tệp Tin An toàn Ngoài Web Root
- **Trạng thái:** Chấp thuận.
- **Bối cảnh:** Nguy cơ tải lên tệp mã độc thực thi (.php, .sh, .exe) (EC-03, NFR-07) và tải tài liệu trái phép qua IDOR (EC-01, BR-11).
- **Quyết định:**
  1. Thư mục lưu trữ nằm ngoài web root (`/app/uploads/materials` và `/app/uploads/submissions`), không được cấu hình static serving công khai bởi web server.
  2. Khi upload, kiểm tra đồng thời phần mở rộng (extension) và MIME type thực tế (thư viện `file-type` kiểm tra magic bytes).
  3. Đổi tên tệp vật lý thành chuỗi UUID v4 ngẫu nhiên (`uuidv4() + ext`). Tên gốc được lưu trong database (`original_filename`).
  4. Mọi yêu cầu tải tệp phải đi qua endpoint API (ví dụ: `GET /api/courses/{id}/materials/{mat_id}/download`), middleware kiểm tra quyền ghi danh hoặc quyền sở hữu trước khi dùng `res.download()` hoặc `fs.createReadStream()` để stream tệp về trình duyệt.
- **Hệ quả:** Loại trừ triệt để nguy cơ thực thi mã độc từ xa (RCE) và ngăn chặn rò rỉ dữ liệu qua URL tĩnh.

### ADR-06: Cơ chế Xử lý Tự Nộp Bài Thi Trắc Nghiệm (Hybrid Auto-Submit)
- **Trạng thái:** Chấp thuận.
- **Bối cảnh:** BR-14 yêu cầu Server tự kích hoạt Auto-submit khi hết giờ; tuy nhiên nếu sinh viên tắt máy, rớt mạng (EC-10) thì client không thể tự gọi API nộp bài.
- **Quyết định:** Sử dụng giải pháp kết hợp đa tầng (Hybrid):
  1. **Tầng 1 (Client Active Submit):** Đồng hồ client đếm về 0 sẽ tự động gọi API `POST /api/attempts/{id}/submit`.
  2. **Tầng 2 (Lazy Server Evaluation):** Khi có bất kỳ request nào truy cập tới attempt hoặc khi tính điểm, nếu `NOW() >= expires_at` và `status == 'IN_PROGRESS'`, hệ thống lập tức đóng lượt thi và chuyển sang `AUTO_SUBMITTED`.
  3. **Tầng 3 (Background Cron Worker):** Thiết lập một tiến trình nền nhẹ (`node-cron`) chạy mỗi **1 phút**, quét các lượt thi có `status = 'IN_PROGRESS'` và `expires_at < NOW() - INTERVAL 30 SECOND` để tự động đối chiếu đáp án, tính điểm và cập nhật trạng thái `AUTO_SUBMITTED` trong database.
- **Hệ quả:** Đảm bảo 100% lượt thi đều được chốt điểm công bằng ngay cả khi sinh viên mất kết nối.

### ADR-07: Chuẩn hóa Quản lý Múi giờ Hệ thống (Asia/Ho_Chi_Minh GMT+7)
- **Trạng thái:** Chấp thuận.
- **Bối cảnh:** Yêu cầu PRD mục 8.2 thống nhất sử dụng múi giờ Việt Nam (`Asia/Ho_Chi_Minh` - GMT+7) cho mọi mốc thời gian (deadline, mở/đóng đề thi, lịch sử nộp).
- **Quyết định:**
  1. Cấu hình MySQL Server và session kết nối với `time_zone = '+07:00'`.
  2. Toàn bộ các cột thời gian dùng kiểu `DATETIME`.
  3. Backend Node.js thiết lập biến môi trường `TZ='Asia/Ho_Chi_Minh'`. Khi serialize JSON trả về cho frontend, các trường thời gian luôn kèm định dạng ISO-8601 có offset rõ ràng (ví dụ: `2026-11-20T23:59:59+07:00`).
  4. Frontend hiển thị thời gian bằng các hàm format theo múi giờ client/Việt Nam.
- **Hệ quả:** Loại bỏ hoàn toàn sự sai lệch giữa giờ máy client và server (EC-06).

---

## 6. Cấu trúc Thư mục Dự án (Project Folder Structure)

```
QuanLyHocTap/
├── .agent/                             # Skills và cấu hình trợ lý
├── database/                           # Dữ liệu và script CSDL
│   ├── schema.sql                      # DDL tạo cấu trúc CSDL chuẩn MySQL
│   └── seed.sql                        # Dữ liệu mẫu khởi tạo ban đầu
├── docs/                               # Tài liệu thiết kế hệ thống
│   ├── PRD.md                          # Yêu cầu sản phẩm
│   ├── flows.md                        # Sơ đồ luồng phác thảo ban đầu
│   ├── architecture.md                 # Tài liệu kiến trúc (File này)
│   ├── database.md                     # Tài liệu thiết kế CSDL chi tiết
│   ├── design-review.md                # Báo cáo kiểm tra chéo & đánh giá
│   └── diagrams/                       # Mã nguồn sơ đồ
│       ├── erd.mermaid                 # ERD chuẩn
│       ├── usecase.mermaid             # Use Case tổng thể
│       ├── sequence.puml               # 16 Sơ đồ tuần tự PlantUML
│       └── state.mermaid               # Sơ đồ trạng thái
├── docker-compose.yml                  # Triển khai môi trường Docker cục bộ
├── backend/                            # Ứng dụng Backend (Node.js + Express)
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   │   ├── server.js                   # Điểm khởi chạy ứng dụng
│   │   ├── app.js                      # Cấu hình Express, Middleware chung
│   │   ├── config/                     # Cấu hình Database, JWT, Upload
│   │   │   ├── db.js                   # MySQL Connection Pool
│   │   │   └── constants.js            # Enum, mã lỗi, hằng số
│   │   ├── middlewares/                # Middleware dùng chung
│   │   │   ├── auth.middleware.js      # Xác thực JWT, check token_version
│   │   │   ├── rbac.middleware.js      # Phân quyền vai trò (Role-based)
│   │   │   ├── rateLimiter.js          # Giới hạn tần suất request
│   │   │   ├── upload.middleware.js    # Cấu hình Multer, kiểm tra file/magic bytes
│   │   │   ├── validator.middleware.js # Kiểm tra tính hợp lệ dữ liệu đầu vào
│   │   │   └── errorHandler.js         # Bắt và chuẩn hóa lỗi hệ thống
│   │   ├── modules/                    # 3 Module nghiệp vụ độc lập
│   │   │   ├── auth_course/            # MODULE 1 (Sinh viên 1)
│   │   │   │   ├── controllers/        # AuthController, CourseController, ScheduleController
│   │   │   │   ├── services/           # AuthService, CourseService, ScheduleService
│   │   │   │   └── repositories/       # UserRepository, CourseRepository, ScheduleRepository
│   │   │   ├── assignment_grade/       # MODULE 2 (Sinh viên 2)
│   │   │   │   ├── controllers/        # AssignmentController, SubmissionController, GradeController
│   │   │   │   ├── services/           # AssignmentService, SubmissionService, GradebookService
│   │   │   │   └── repositories/       # AssignmentRepository, SubmissionRepository
│   │   │   └── quiz_comm/              # MODULE 3 (Sinh viên 3)
│   │   │       ├── controllers/        # QuizController, AttemptController, CommController
│   │   │       ├── services/           # QuizService, AttemptService, CommunicationService
│   │   │       └── repositories/       # QuizRepository, AttemptRepository, CommRepository
│   │   ├── workers/                    # Tiến trình nền
│   │   │   └── cronWorker.js           # Auto-submit quá hạn, dọn tệp rác
│   │   └── utils/                      # Tiện ích chung
│   │       ├── responseFormatter.js    # Chuẩn hóa payload trả về
│   │       ├── sanitizer.js            # Lọc mã độc XSS
│   │       └── csvExporter.js          # Xuất CSV an toàn (chống CSV Injection)
│   └── uploads/                        # Thư mục chứa tệp đính kèm ngoài Web Root
│       ├── materials/                  # Tệp bài giảng (.pdf, .zip, ...)
│       └── submissions/                # Tệp bài nộp sinh viên
└── frontend/                           # Ứng dụng Frontend (React + Vite)
    ├── Dockerfile
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx                     # Điều hướng Router chính
        ├── main.jsx                    # Entry point
        ├── api/                        # Axios instance, Interceptors, API Services
        ├── components/                 # UI components dùng chung (shadcn/ui)
        │   ├── ui/                     # Button, Dialog, Input, Table, Card...
        │   └── shared/                 # Navbar, Sidebar, Footer, TimerCountdown
        ├── contexts/                   # AuthContext, NotificationContext
        └── pages/                      # Màn hình theo phân hệ
            ├── auth/                   # Đăng nhập, Đổi mật khẩu
            ├── admin/                  # Quản lý người dùng
            ├── instructor/             # Quản lý khóa học, bài tập, đề thi, chấm bài, lịch học
            └── student/                # Danh sách khóa học, xem bài giảng, nộp bài, phòng thi
```

---

## 7. Cấu hình Triển khai Cục bộ (docker-compose.yml)

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: lms_mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: root_password_123
      MYSQL_DATABASE: lms_mini_db
      MYSQL_USER: lms_user
      MYSQL_PASSWORD: lms_password_123
      TZ: "Asia/Ho_Chi_Minh"
    command:
      - --default-authentication-plugin=mysql_native_password
      - --character-set-server=utf8mb4
      - --collation-server=utf8mb4_unicode_ci
      - --default-time-zone=+07:00
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ./database/schema.sql:/docker-entrypoint-initdb.d/01_schema.sql
      - ./database/seed.sql:/docker-entrypoint-initdb.d/02_seed.sql
    networks:
      - lms_network
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: lms_backend
    restart: always
    depends_on:
      mysql:
        condition: service_healthy
    environment:
      NODE_ENV: development
      PORT: 5000
      TZ: "Asia/Ho_Chi_Minh"
      DB_HOST: mysql
      DB_PORT: 3306
      DB_USER: lms_user
      DB_PASSWORD: lms_password_123
      DB_NAME: lms_mini_db
      JWT_SECRET: your_jwt_super_secret_key_2026
      JWT_EXPIRES_IN: 15m
      REFRESH_TOKEN_EXPIRES_IN: 7d
      UPLOAD_DIR: /app/uploads
    ports:
      - "5000:5000"
    volumes:
      - ./backend:/app
      - /app/node_modules
      - file_uploads:/app/uploads
    networks:
      - lms_network

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: lms_frontend
    restart: always
    depends_on:
      - backend
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    networks:
      - lms_network

networks:
  lms_network:
    driver: bridge

volumes:
  mysql_data:
  file_uploads:
```

---

## 8. Bảng Quyết định Thiết kế Đáp ứng Yêu cầu Phi chức năng & Edge Cases

| Mã YC / EC | Yêu cầu kỹ thuật | Quyết định thiết kế kiến trúc cụ thể |
|---|---|---|
| **NFR-05** | Phân quyền RBAC | Middleware `rbacMiddleware(['ADMIN', 'GIANG_VIEN'])` giải mã token, lấy role và so sánh với danh sách quyền cho phép trước khi vào Controller. |
| **NFR-06, EC-08, EC-22** | Rate Limiting | Cấu hình `express-rate-limit`: Đăng nhập tối đa 5 lần/phút/IP; Nộp bài tối đa 10 lần/phút/IP; Nhập mã ghi danh thử tối đa 5 lần/phút/IP. Trả về mã lỗi 429 Too Many Requests. |
| **BR-02, EC-08** | Khóa tạm thời 15 phút do nhập sai mật khẩu | Cột `failed_login_attempts INT DEFAULT 0` và `lockout_until DATETIME NULL` trong bảng `users`. Nếu `failed_login_attempts >= 5`, gán `lockout_until = NOW() + INTERVAL 15 MINUTE` và đổi trạng thái sang `TEMPORARY_LOCKED`. |
| **US-02, EC-14** | Thu hồi phiên đăng nhập lập tức khi khóa tài khoản | Cột `token_version INT DEFAULT 1` trong bảng `users`. Khi Admin khóa tài khoản, tăng `token_version += 1` và xóa các token trong bảng `refresh_tokens`. Middleware kiểm tra `token_version` trên mỗi request. |
| **BR-10, NFR-07, EC-03** | Upload tệp an toàn & Chống mã độc | Thư mục lưu tệp nằm ngoài web root. Sử dụng `multer` với bộ lọc MIME whitelist (`application/pdf`, `.docx`, `.zip`). Sử dụng thư viện `file-type` kiểm tra magic bytes của buffer tệp. Đổi tên tệp thành UUID v4 ngẫu nhiên. |
| **BR-11, EC-01** | Chống IDOR khi tải tệp | Không mở static file server. Tải tệp thông qua API: Controller gọi Service kiểm tra quyền (Sinh viên đã ghi danh hoặc Giảng viên sở hữu khóa học), sau đó mới tạo stream gửi file (`fs.createReadStream`). |
| **EC-18** | Tải tệp đồng thời nhiều người | Sử dụng Node.js Stream (`res.setHeader('Content-Type', ...)`, `readStream.pipe(res)`) để không nạp toàn bộ tệp vào RAM server, duy trì RAM thấp khi nhiều sinh viên tải tài liệu 50MB cùng lúc. |
| **EC-19** | Dọn dẹp tệp mồ côi | Worker định kỳ đối chiếu danh sách file vật lý trong `/app/uploads` với bảng `materials` và `submissions`. Tệp không có khóa ngoại tham chiếu sau 24h sẽ được tự động xóa. |
| **BR-18, EC-11** | Chống Stored XSS | Áp dụng thư viện `sanitize-html` tại tầng Controller/Service để làm sạch mã HTML của bài viết thảo luận, thông báo và tiêu đề bài giảng trước khi ghi vào database. |
| **BR-16, EC-17** | Chống CSV Injection | Khi xuất bảng điểm ra file CSV (US-14), kiểm tra ký tự đầu tiên của mỗi ô: nếu bắt đầu bằng `=`, `+`, `-`, `@`, tự động thêm dấu nháy đơn `'` ở đầu ô. Thêm ký tự UTF-8 BOM (`\uFEFF`) để Excel hiển thị tiếng Việt không lỗi font. |
| **EC-04** | Chống Race Condition khi nộp bài (Double submit) | Frontend disable nút nộp ngay sau click đầu. Backend đặt ràng buộc `UNIQUE KEY uk_assignment_student (assignment_id, student_id)` trên bảng `submissions` và kiểm tra transaction khi ghi đè. |
| **NFR-08, EC-05** | Transaction khi chấm và nộp bài thi | Toàn bộ thao tác cập nhật trạng thái `Attempt`, đối chiếu đáp án, tính tổng điểm và cập nhật bảng điểm được thực hiện trong **1 Transaction duy nhất (`BEGIN ... COMMIT`)**. Bất kỳ ngoại lệ nào đều kích hoạt `ROLLBACK`. |
| **EC-06, BR-14** | Đồng bộ thời gian thi | Thời gian bắt đầu `started_at` và hết hạn `expires_at` do server tính toán và ghi nhận. API trả về `remaining_seconds` tính từ server. Client chỉ hiển thị đếm ngược; khi hết giờ, server chủ động cắt quyền nhận bài. |
| **NFR-01, NFR-02, NFR-03** | Khả năng đáp ứng và chịu tải (100 CCU, 50 nộp trong 2 phút) | Cấu hình MySQL Connection Pool (kích cỡ 10–30 kết nối); tạo chỉ mục phù hợp trên các khóa ngoại; giữ transaction cực ngắn (chỉ bọc các câu lệnh ghi điểm, không đặt câu lệnh I/O đọc file trong transaction); sử dụng paging 20 mục/trang cho bảng điểm (EC-21). |

---

## 9. Giả định Thiết kế cho 12 Điểm Chưa Nhất Quán (Mục C)

Dưới đây là các quyết định thiết kế dứt khoát được lựa chọn cho 12 điểm phát hiện tại Mục C:

1. **Mã ghi danh (Enrollment Key):** Thống nhất định dạng 6-8 ký tự (`VARCHAR(8)`), phân biệt hoa thường (`COLLATE utf8mb4_bin`). Mặc định khi sinh ngẫu nhiên là 6 ký tự gồm chữ hoa và số; giảng viên có thể sửa đổi thành 6-8 ký tự (chấp nhận mã 7 ký tự như `"WEB2026"`).
2. **Nộp lại bài tập:** Cho phép nộp lại cả trước hạn và sau hạn (nếu bài tập bật `allow_late`). Thiết kế cập nhật ghi đè bản ghi nộp bài hiện tại trong bảng `submissions`, tăng biến đếm `submission_count`, cập nhật lại `file_uuid`, `submitted_at`, `is_late`, `late_minutes`, và xóa file vật lý cũ để tránh tệp mồ côi.
3. **Đáp án đúng đề trắc nghiệm:** Trong phạm vi MVP, mỗi câu hỏi là **Single-choice** (chỉ có duy nhất 1 đáp án đúng trong số 2–5 lựa chọn). Bảng `options` có cột `is_correct BOOLEAN`, tầng Service kiểm tra bắt buộc có đúng 1 đáp án đúng khi tạo câu hỏi.
4. **Cách tính điểm trắc nghiệm:** Sử dụng công thức chuẩn hóa thang điểm 10 theo flows.md:  
   $$\text{Score} = \text{ROUND}\left(\frac{\text{correct\_count}}{\text{total\_questions}} \times 10.0, 2\right)$$
   Lưu trữ kiểu `DECIMAL(4,2)`.
5. **Thông báo hệ thống:** Bổ sung thực thể bảng `notifications` trong cơ sở dữ liệu để phục vụ việc gửi thông báo tự động cho sinh viên khi có bài tập mới (US-07), thông báo mới (US-15) và đổi lịch học (EC-24).
6. **Vô hiệu hóa phiên đăng nhập tức thì:** Sử dụng cột `token_version INT DEFAULT 1` trên bảng `users` kết hợp bảng `refresh_tokens`. Khi Admin khóa tài khoản (US-02), `token_version` được tăng lên 1, làm vô hiệu hóa ngay lập tức mọi JWT Access Token đang lưu hành của người dùng đó.
7. **Tự nộp bài khi hết giờ:** Áp dụng cơ chế **Hybrid Resilient**: Client gọi nộp khi đếm ngược về 0; nếu Client mất mạng hoặc tắt máy, Server có cơ chế Lazy Check khi có request và một **Cron Worker chạy ngầm mỗi 1 phút** để tự động quét các attempt quá hạn và chuyển trạng thái sang `AUTO_SUBMITTED`.
8. **Trạng thái Đề thi & Lượt thi:**
   - Đề thi (`quizzes`): Sử dụng tập trạng thái rõ ràng gồm `DRAFT`, `PUBLISHED`, `CLOSED`.
   - Lượt thi (`attempts`): Giữ nguyên 3 trạng thái chuẩn của PRD gồm `IN_PROGRESS`, `SUBMITTED`, `AUTO_SUBMITTED`. Bỏ trạng thái trung gian `Grading` và `Abandoned` trong flows.md vì việc chấm điểm diễn ra tức thì trong Database Transaction.
9. **Hủy ghi danh (Unenroll):** Chưa đưa vào MVP (hoãn lại). Trong MVP, chỉ Giảng viên hoặc Admin mới có quyền xóa sinh viên khỏi lớp học khi sinh viên chưa có bài nộp hoặc điểm thi nào.
10. **Tài khoản mới tạo & Quản lý mật khẩu:** Bổ sung cột `must_change_password BOOLEAN DEFAULT TRUE` trong bảng `users`. Bổ sung API `POST /api/auth/change-password` và `POST /api/auth/logout`. Sinh viên/Giảng viên đăng nhập lần đầu bằng mật khẩu mặc định được yêu cầu đổi mật khẩu.
11. **Bổ sung Admin ở thông báo & Đính chính EC:** Use case diagram (`usecase.mermaid`) được bổ sung tác nhân Admin kết nối tới tính năng đăng thông báo khóa học (US-15) theo đúng quy tắc BR-17. Đính chính bảng EC trong PRD gồm chính xác 24 kịch bản biên (EC-01 đến EC-24).
12. **Chiến lược Xóa mềm (Soft Delete):** Thống nhất áp dụng cột `deleted_at DATETIME NULL` cho các bảng chính (`users`, `courses`, `assignments`, `quizzes`). Trạng thái `ARCHIVED` của khóa học là trạng thái nghiệp vụ (khóa học kết thúc học kỳ, chuyển sang chế độ chỉ đọc để tra cứu), hoàn toàn độc lập với việc xóa mềm `deleted_at`.

