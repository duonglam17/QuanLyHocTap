# SƠ ĐỒ LUỒNG NGHIỆP VỤ (BUSINESS FLOWS) - LMS MINI

Tài liệu này mô tả chi tiết các luồng nghiệp vụ của hệ thống LMS Mini dưới dạng sơ đồ Mermaid trực quan, phục vụ việc đối chiếu giữa tài liệu PRD và giai đoạn thiết kế kiến trúc, cơ sở dữ liệu.

---

## 1. Sơ đồ Use Case Tổng quan Hệ thống (System Use Case Flowchart)

Sơ đồ thể hiện sự tương tác của 3 Actor chính (Admin, Giảng viên, Sinh viên) đối với các nhóm chức năng trong hệ thống LMS Mini.

```mermaid
flowchart LR
    subgraph Actors["Tác nhân (Actors)"]
        Admin["Admin (Quản trị viên)"]
        GV["Giảng viên (Instructor)"]
        SV["Sinh viên (Student)"]
    end

    subgraph E1["E1: Tài khoản & Xác thực"]
        UC_Login["Đăng nhập hệ thống (US-01)"]
        UC_UserMgmt["Quản lý người dùng (US-02)"]
    end

    subgraph E2["E2: Khóa học & Bài giảng"]
        UC_CreateCourse["Tạo & Quản lý khóa học (US-03)"]
        UC_Enroll["Ghi danh bằng mã (US-04)"]
        UC_UploadMaterial["Đăng bài giảng & tài liệu (US-05)"]
        UC_DownloadMaterial["Xem & tải tài liệu (US-06)"]
    end

    subgraph E3["E3: Bài tập Tự luận"]
        UC_CreateAssign["Giao bài tập tự luận (US-07)"]
        UC_SubmitAssign["Nộp bài tập (US-08)"]
        UC_GradeAssign["Chấm điểm & nhận xét (US-09)"]
    end

    subgraph E4["E4: Thi Trắc nghiệm"]
        UC_CreateQuiz["Tạo đề thi trắc nghiệm (US-10)"]
        UC_TakeQuiz["Làm bài thi trực tuyến (US-11)"]
        UC_AutoGrade["Tự động chấm điểm (US-12)"]
    end

    subgraph E5["E5: Bảng điểm"]
        UC_ViewStudentGrade["Xem bảng điểm cá nhân (US-13)"]
        UC_ExportGrade["Xuất bảng điểm lớp (US-14)"]
    end

    subgraph E6["E6: Tương tác"]
        UC_Announce["Đăng & xem thông báo (US-15)"]
        UC_Discuss["Thảo luận bài học (US-16)"]
    end

    %% Admin connections
    Admin --> UC_Login
    Admin --> UC_UserMgmt

    %% GV connections
    GV --> UC_Login
    GV --> UC_CreateCourse
    GV --> UC_UploadMaterial
    GV --> UC_CreateAssign
    GV --> UC_GradeAssign
    GV --> UC_CreateQuiz
    GV --> UC_ExportGrade
    GV --> UC_Announce
    GV --> UC_Discuss

    %% SV connections
    SV --> UC_Login
    SV --> UC_Enroll
    SV --> UC_DownloadMaterial
    SV --> UC_SubmitAssign
    SV --> UC_TakeQuiz
    SV --> UC_ViewStudentGrade
    SV --> UC_Announce
    SV --> UC_Discuss

    %% System connection
    UC_TakeQuiz -.-> UC_AutoGrade
```

---

## 2. Luồng Nộp bài và Chấm bài Tự luận (Assignment & Grading Flow)

Luồng chi tiết từ khi Giảng viên giao bài tập, Sinh viên nộp tệp bài làm (xử lý trường hợp đúng hạn và trễ hạn, phòng chống double submit), đến khi Giảng viên chấm điểm và Sinh viên xem kết quả.

```mermaid
sequenceDiagram
    autonumber
    actor GV as Giảng viên
    actor SV as Sinh viên
    participant FE as Frontend Client
    participant BE as Backend Server
    participant DB as Database
    participant FS as File Storage

    Note over GV, BE: Giai đoạn 1: Giảng viên tạo bài tập
    GV->>FE: Nhập tiêu đề, yêu cầu, hạn nộp (Deadline), thang điểm 10
    FE->>BE: POST /api/courses/{course_id}/assignments
    BE->>DB: Lưu Assignment (status: OPEN)
    BE-->>FE: Phản hồi tạo thành công
    FE-->>GV: Hiển thị bài tập trên khóa học

    Note over SV, FS: Giai đoạn 2: Sinh viên nộp bài làm
    SV->>FE: Chọn tệp bài làm (PDF/ZIP, < 20MB)
    SV->>FE: Bấm nút "Nộp bài"
    Note over FE: Disable nút bấm ngay lập tức (Chống Double Submit)
    FE->>BE: POST /api/assignments/{id}/submissions (Multipart Form)
    BE->>BE: Kiểm tra xác thực & quyền thành viên
    BE->>BE: Kiểm tra loại tệp & dung lượng an toàn (Chống mã độc)
    BE->>FS: Lưu tệp với tên UUID ngẫu nhiên
    BE->>BE: So sánh thời gian nộp với Server Deadline
    alt Nộp trước hoặc đúng hạn
        BE->>DB: Lưu Submission (status: SUBMITTED, is_late: false)
    else Nộp sau hạn (nếu được phép nộp trễ)
        BE->>DB: Lưu Submission (status: SUBMITTED_LATE, is_late: true, late_minutes)
    end
    BE-->>FE: HTTP 200 (Nộp bài thành công)
    FE-->>SV: Thông báo nộp bài thành công & hiển thị thời gian nộp

    Note over GV, SV: Giai đoạn 3: Giảng viên chấm điểm & trả nhận xét
    GV->>FE: Xem danh sách bài nộp của lớp
    FE->>BE: GET /api/assignments/{id}/submissions
    BE->>DB: Truy vấn danh sách bài nộp
    BE-->>FE: Danh sách bài nộp kèm link tải tệp an toàn
    GV->>FE: Nhập điểm số (0 - 10) và lời nhận xét
    FE->>BE: POST /api/submissions/{sub_id}/grade
    BE->>BE: Kiểm tra quyền sở hữu khóa học (Chống IDOR)
    BE->>BE: Validate điểm nằm trong [0.0, 10.0]
    BE->>DB: Cập nhật Submission (status: GRADED, score, feedback)
    BE-->>FE: Cập nhật thành công
    FE-->>GV: Hiển thị trạng thái "Đã chấm điểm"

    Note over SV, FE: Giai đoạn 4: Sinh viên xem điểm
    SV->>FE: Vào mục Bảng điểm / Chi tiết bài tập
    FE->>BE: GET /api/submissions/my-grade
    BE->>DB: Lấy điểm và nhận xét của sinh viên đang đăng nhập
    BE-->>FE: Trả kết quả điểm
    FE-->>SV: Hiển thị điểm số và nhận xét của giảng viên
```

---

## 3. Luồng Thi Trắc nghiệm và Tự động Chấm điểm (Quiz & Auto-grading Flow)

Luồng chi tiết quá trình làm bài thi trực tuyến: đồng bộ thời gian từ server, auto-save đáp án khi chọn, xử lý nộp bài chủ động hoặc tự động thu bài khi hết giờ, và chấm điểm trong một database transaction.

```mermaid
sequenceDiagram
    autonumber
    actor SV as Sinh viên
    participant FE as Web Client (Phòng thi)
    participant BE as Backend Server
    participant DB as Database

    Note over SV, DB: Bắt đầu lượt thi (Start Attempt)
    SV->>FE: Nhấn "Bắt đầu làm bài thi"
    FE->>BE: POST /api/quizzes/{quiz_id}/start
    BE->>DB: Kiểm tra sinh viên đã thi chưa (Chỉ thi 1 lần)
    BE->>DB: Tạo bản ghi Attempt (status: IN_PROGRESS, started_at = NOW)
    BE->>DB: Tính expires_at = started_at + duration_minutes
    BE->>DB: Lấy danh sách câu hỏi & các lựa chọn (KHÔNG kèm đáp án đúng)
    BE-->>FE: Trả về: attempt_id, danh sách câu hỏi, remaining_seconds
    FE->>FE: Khởi chạy đồng hồ đếm ngược căn theo remaining_seconds

    Note over SV, DB: Quá trình làm bài & Tự động lưu (Auto-save)
    loop Trong khi làm bài
        SV->>FE: Chọn đáp án cho câu hỏi
        FE->>BE: PATCH /api/attempts/{attempt_id}/save-answer (question_id, option_id)
        BE->>DB: Lưu tạm đáp án của sinh viên (AttemptAnswer)
        BE-->>FE: HTTP 200 OK (Đã lưu)
    end

    Note over SV, DB: Kết thúc bài thi (Nộp bài chủ động HOẶC Hết giờ)
    alt Sinh viên chủ động nộp bài
        SV->>FE: Bấm nút "Nộp bài thi" & xác nhận
        FE->>BE: POST /api/attempts/{attempt_id}/submit
    else Đồng hồ đếm ngược về 00:00:00 (Hết giờ)
        FE->>FE: Khóa giao diện làm bài
        FE->>BE: POST /api/attempts/{attempt_id}/submit (Auto-submit)
    end

    Note over BE, DB: Xử lý chấm điểm tự động (Database Transaction)
    BE->>DB: BEGIN TRANSACTION
    BE->>DB: Cập nhật Attempt status = SUBMITTED / AUTO_SUBMITTED
    BE->>DB: Lấy đáp án chuẩn của Quiz từ DB
    BE->>BE: Đối chiếu từng câu trả lời của sinh viên với đáp án đúng
    BE->>BE: Tính tổng điểm = (Số câu đúng / Tổng số câu) * 10.0
    BE->>DB: Ghi nhận tổng điểm và số câu đúng vào bảng Attempt
    BE->>DB: COMMIT TRANSACTION
    BE-->>FE: Trả về kết quả: Tổng điểm đạt được
    FE-->>SV: Hiển thị kết quả điểm số cho sinh viên
```

---

## 4. Các Sơ đồ Trạng thái (State Diagrams)

### 4.1. Sơ đồ Trạng thái Khóa học (Course State Diagram)

```mermaid
stateDiagram-v2
    [*] --> Draft : Giảng viên tạo khóa học
    Draft --> Published : Giảng viên xuất bản khóa học (Mở ghi danh)
    Published --> Archived : Giảng viên kết thúc học kỳ / Đóng khóa học (Chỉ đọc)
    Draft --> Archived : Hủy khóa học khi chưa triển khai
    Archived --> [*]

    state Draft {
        [*] --> SetupInfo
        SetupInfo --> AddContent : Thêm bài giảng & bài tập
    }

    state Published {
        [*] --> OpenEnrollment : Cho phép nhập mã tham gia
        OpenEnrollment --> InTeaching : Diễn ra việc dạy, học, nộp bài, thi cử
    }

    state Archived {
        [*] --> ReadOnly : Không cho nộp bài hoặc thi mới, chỉ tra cứu lịch sử
    }
```

---

### 4.2. Sơ đồ Trạng thái Bài nộp Tự luận (Submission State Diagram)

```mermaid
stateDiagram-v2
    [*] --> NotSubmitted : Bài tập được phát hành (OPEN)

    NotSubmitted --> Submitted : Sinh viên nộp bài đúng hạn
    NotSubmitted --> SubmittedLate : Sinh viên nộp bài sau deadline (nếu cho phép)

    Submitted --> Submitted : Sinh viên nộp lại phiên bản mới (trước deadline)
    SubmittedLate --> SubmittedLate : Sinh viên nộp lại (ghi nhận số phút trễ mới)

    Submitted --> Graded : Giảng viên chấm điểm & phản hồi
    SubmittedLate --> Graded : Giảng viên chấm điểm & xem xét trừ điểm trễ

    Graded --> Graded : Giảng viên cập nhật lại điểm (nếu có phúc khảo)

    Graded --> [*]
```

---

### 4.3. Sơ đồ Trạng thái Lượt thi Trắc nghiệm (Quiz Attempt State Diagram)

```mermaid
stateDiagram-v2
    [*] --> InProgress : Sinh viên bấm "Bắt đầu làm bài"

    state InProgress {
        [*] --> Answering : Đọc câu hỏi & chọn đáp án
        Answering --> AutoSaving : Gửi lưu đáp án ngầm
        AutoSaving --> Answering : Tiếp tục làm các câu khác
    }

    InProgress --> Submitted : Sinh viên bấm "Nộp bài" trước khi hết giờ
    InProgress --> AutoSubmitted : Hết thời gian làm bài (Server timer đếm về 0)
    InProgress --> Abandoned : Sinh viên thoát giữa chừng và không quay lại trước khi hết giờ

    Submitted --> Grading : Kích hoạt tính điểm
    AutoSubmitted --> Grading : Kích hoạt tính điểm
    Abandoned --> Grading : Tự động nộp khi hết giờ đề thi

    state Grading {
        [*] --> ComparingAnswers : Đối chiếu với đáp án chuẩn
        ComparingAnswers --> CalculatingScore : Tính điểm theo trọng số
        CalculatingScore --> RecordResult : Lưu vào DB Transaction
    }

    Grading --> Completed : Hoàn tất chấm điểm & cập nhật điểm vào bảng điểm

    Completed --> [*]
```

