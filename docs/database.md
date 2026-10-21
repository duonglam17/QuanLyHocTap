# THIẾT KẾ CƠ SỞ DỮ LIỆU CHI TIẾT (DATABASE DESIGN) - LMS MINI

---

## 1. Tổng quan Thiết kế

Cơ sở dữ liệu của dự án **LMS Mini** được thiết kế chạy trên **MySQL 8.0**, Storage Engine **InnoDB**, bộ mã ký tự **utf8mb4** và collation **utf8mb4_unicode_ci**. Toàn bộ cấu trúc được chuẩn hóa đạt mức **Dạng chuẩn 3 (3NF)**, đáp ứng các ràng buộc toàn vẹn nghiêm ngặt về học vụ và an toàn bảo mật.

---

## 2. Danh mục Bảng và Mô tả Chi tiết (Data Dictionary)

### 2.1. Nhóm Module M1: Nền tảng, Người dùng & Khóa học (E1, E2)

#### 1. Bảng `roles` (Vai trò người dùng)
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | INT | PK, AUTO_INCREMENT | Mã định danh vai trò |
| `name` | VARCHAR(20) | NOT NULL, UNIQUE | Tên vai trò: `ADMIN`, `GIANG_VIEN`, `SINH_VIEN` |
| `description` | VARCHAR(100) | NULL | Diễn giải chức năng vai trò |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Thời điểm tạo |

#### 2. Bảng `users` (Tài khoản người dùng)
*Truy vết: US-01, US-02, BR-01, BR-02, NFR-04, NFR-09*
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | Mã định danh người dùng |
| `role_id` | INT | NOT NULL, FK -> `roles.id` (RESTRICT) | Vai trò tài khoản |
| `username` | VARCHAR(50) | NOT NULL, UNIQUE | Tên đăng nhập |
| `email` | VARCHAR(100) | NOT NULL, UNIQUE | Địa chỉ email liên hệ |
| `password_hash` | VARCHAR(255) | NOT NULL | Chuỗi băm mật khẩu (BCrypt cost 10) |
| `full_name` | VARCHAR(100) | NOT NULL | Họ và tên đầy đủ |
| `status` | ENUM | NOT NULL, DEFAULT 'ACTIVE' | `ACTIVE`, `LOCKED`, `TEMPORARY_LOCKED` |
| `failed_login_attempts` | INT | NOT NULL, DEFAULT 0 | Số lần đăng nhập sai liên tiếp (BR-02) |
| `lockout_until` | DATETIME | NULL | Thời điểm hết hạn khóa tạm 15 phút (BR-02) |
| `token_version` | INT | NOT NULL, DEFAULT 1 | Phiên bản token để thu hồi phiên tức thì (US-02) |
| `must_change_password` | BOOLEAN | NOT NULL, DEFAULT TRUE | Cờ buộc đổi mật khẩu lần đầu (US-02) |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Thời điểm tạo tài khoản |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | Thời điểm cập nhật cuối |
| `deleted_at` | DATETIME | NULL | Đánh dấu xóa mềm tài khoản (NFR-09) |

#### 3. Bảng `refresh_tokens` (Quản lý phiên làm việc & Refresh Token)
*Truy vết: US-01, US-02, EC-14*
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | Mã token |
| `user_id` | BIGINT | NOT NULL, FK -> `users.id` (CASCADE) | Người dùng sở hữu |
| `token_hash` | VARCHAR(255) | NOT NULL, UNIQUE | Chuỗi hash token lưu trữ |
| `expires_at` | DATETIME | NOT NULL | Thời điểm hết hạn token (7 ngày) |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Thời điểm cấp |

#### 4. Bảng `courses` (Khóa học)
*Truy vết: US-03, BR-03, BR-04, EC-09, NFR-09*
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | Mã khóa học |
| `code` | VARCHAR(20) | NOT NULL | Mã môn học (ví dụ: `INT3101`) |
| `title` | VARCHAR(200) | NOT NULL | Tên khóa học đầy đủ |
| `description` | TEXT | NULL | Mô tả tóm tắt nội dung môn học |
| `semester` | VARCHAR(20) | NOT NULL | Học kỳ (ví dụ: `HK1-2026`) |
| `instructor_id` | BIGINT | NOT NULL, FK -> `users.id` (RESTRICT) | Giảng viên phụ trách khóa học |
| `enrollment_key` | VARCHAR(8) | NOT NULL, UNIQUE, COLLATE utf8mb4_bin | Mã ghi danh phân biệt hoa thường (BR-04) |
| `status` | ENUM | NOT NULL, DEFAULT 'DRAFT' | Trạng thái: `DRAFT`, `PUBLISHED`, `ARCHIVED` |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Thời điểm tạo |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | Thời điểm sửa |
| `deleted_at` | DATETIME | NULL | Đánh dấu xóa mềm khóa học |

#### 5. Bảng `enrollments` (Ghi danh khóa học)
*Truy vết: US-04, BR-04, BR-05, EC-15, EC-22*
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | Mã bản ghi |
| `course_id` | BIGINT | NOT NULL, FK -> `courses.id` (RESTRICT) | Khóa học tham gia |
| `student_id` | BIGINT | NOT NULL, FK -> `users.id` (RESTRICT) | Sinh viên ghi danh |
| `enrolled_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Thời điểm ghi danh thành công |
| *UNIQUE* | - | `UNIQUE KEY (course_id, student_id)` | Mỗi sinh viên chỉ ghi danh 1 lần vào 1 khóa |

#### 6. Bảng `lessons` (Chủ đề / Bài giảng trong khóa học)
*Truy vết: US-05, US-06*
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | Mã bài giảng |
| `course_id` | BIGINT | NOT NULL, FK -> `courses.id` (CASCADE) | Thuộc khóa học |
| `title` | VARCHAR(200) | NOT NULL | Tiêu đề bài giảng (ví dụ: Chương 1) |
| `content` | TEXT | NULL | Nội dung chi tiết hoặc hướng dẫn |
| `order_index` | INT | NOT NULL, DEFAULT 1 | Thứ tự hiển thị trong khóa học |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Ngày tạo |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | Ngày cập nhật |

#### 7. Bảng `materials` (Tệp tài liệu đính kèm bài giảng)
*Truy vết: US-05, US-06, BR-06, BR-10, BR-11, NFR-07*
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | Mã tài liệu |
| `lesson_id` | BIGINT | NOT NULL, FK -> `lessons.id` (CASCADE) | Thuộc bài giảng |
| `title` | VARCHAR(200) | NOT NULL | Tên hiển thị của tài liệu |
| `original_filename` | VARCHAR(255) | NOT NULL | Tên tệp gốc của người dùng (EC-20) |
| `file_uuid` | VARCHAR(64) | NOT NULL, UNIQUE | Tên file vật lý ngẫu nhiên trên đĩa (BR-10) |
| `file_path` | VARCHAR(500) | NOT NULL | Đường dẫn tuyệt đối ngoài Web Root |
| `file_size_bytes` | BIGINT | NOT NULL | Kích thước tệp (bytes, tối đa 50MB, BR-06) |
| `mime_type` | VARCHAR(100) | NOT NULL | MIME Type chuẩn được kiểm định magic bytes |
| `uploaded_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Thời điểm tải lên |

#### 8. Bảng `schedules` (Lịch học / Thời khóa biểu)
*Truy vết: US-17, US-18, BR-19, BR-20, EC-23, EC-24*
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | Mã buổi học |
| `course_id` | BIGINT | NOT NULL, FK -> `courses.id` (CASCADE) | Khóa học |
| `title` | VARCHAR(200) | NOT NULL | Chủ đề buổi học |
| `date` | DATE | NOT NULL | Ngày diễn ra buổi học |
| `start_time` | TIME | NOT NULL | Giờ bắt đầu (ví dụ: `08:00:00`) |
| `end_time` | TIME | NOT NULL | Giờ kết thúc (ví dụ: `11:30:00`) |
| `room_or_link` | VARCHAR(255) | NOT NULL | Phòng học hoặc URL học trực tuyến |
| `status` | ENUM | NOT NULL, DEFAULT 'SCHEDULED' | `SCHEDULED`, `RESCHEDULED`, `CANCELLED` |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Ngày tạo |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | Ngày cập nhật |
| *CHECK* | - | `CHECK (start_time < end_time)` | Giờ kết thúc phải sau giờ bắt đầu (BR-19) |

---

### 2.2. Nhóm Module M2: Bài tập & Bảng điểm (E3, E5)

#### 9. Bảng `assignments` (Bài tập tự luận)
*Truy vết: US-07, BR-07, BR-08, EC-09, EC-12*
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | Mã bài tập |
| `course_id` | BIGINT | NOT NULL, FK -> `courses.id` (RESTRICT) | Thuộc khóa học |
| `title` | VARCHAR(200) | NOT NULL | Tiêu đề bài tập |
| `description` | TEXT | NULL | Đề bài, yêu cầu chi tiết |
| `deadline` | DATETIME | NOT NULL | Hạn chót nộp bài theo giờ server (BR-07) |
| `max_score` | DECIMAL(4,2) | NOT NULL, DEFAULT 10.00 | Thang điểm tối đa (thường là 10.00) |
| `allow_late` | BOOLEAN | NOT NULL, DEFAULT FALSE | Cho phép nộp muộn sau deadline hay không |
| `status` | ENUM | NOT NULL, DEFAULT 'OPEN' | Trạng thái bài tập: `OPEN`, `CLOSED` |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Ngày tạo |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | Ngày cập nhật |
| `deleted_at` | DATETIME | NULL | Đánh dấu xóa mềm |

#### 10. Bảng `submissions` (Bài nộp tự luận của sinh viên)
*Truy vết: US-08, BR-07, BR-10, EC-04, EC-20*
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | Mã bài nộp |
| `assignment_id` | BIGINT | NOT NULL, FK -> `assignments.id` (RESTRICT) | Bài tập tương ứng |
| `student_id` | BIGINT | NOT NULL, FK -> `users.id` (RESTRICT) | Sinh viên nộp |
| `original_filename` | VARCHAR(255) | NOT NULL | Tên tệp gốc sinh viên tải lên |
| `file_uuid` | VARCHAR(64) | NOT NULL, UNIQUE | Tên file vật lý ngẫu nhiên ngoài web root |
| `file_path` | VARCHAR(500) | NOT NULL | Đường dẫn file vật lý trên đĩa |
| `file_size_bytes` | BIGINT | NOT NULL | Dung lượng tệp (tối đa 20MB, BR-07) |
| `mime_type` | VARCHAR(100) | NOT NULL | Định dạng tệp đã xác thực |
| `submitted_at` | DATETIME | NOT NULL | Thời điểm nộp bài theo server time |
| `is_late` | BOOLEAN | NOT NULL, DEFAULT FALSE | Đánh dấu nộp trễ hạn (BR-07) |
| `late_minutes` | INT | NOT NULL, DEFAULT 0 | Số phút nộp muộn so với deadline |
| `submission_count` | INT | NOT NULL, DEFAULT 1 | Số lần nộp lại của sinh viên (Mục C.2) |
| `status` | ENUM | NOT NULL, DEFAULT 'SUBMITTED' | `SUBMITTED`, `SUBMITTED_LATE`, `GRADED` |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Thời điểm tạo bản ghi |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | Thời điểm cập nhật cuối |
| *UNIQUE* | - | `UNIQUE KEY (assignment_id, student_id)` | Mỗi sinh viên có duy nhất 1 bản ghi nộp (chống double submit EC-04) |

#### 11. Bảng `grades` (Điểm số và đánh giá bài tự luận)
*Truy vết: US-09, US-13, US-14, BR-08, BR-09, EC-16*
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | Mã bản ghi điểm |
| `submission_id` | BIGINT | NOT NULL, UNIQUE, FK -> `submissions.id` (CASCADE) | Bài nộp được chấm |
| `graded_by` | BIGINT | NOT NULL, FK -> `users.id` (RESTRICT) | Giảng viên chấm điểm |
| `score` | DECIMAL(4,2) | NOT NULL | Điểm số từ 0.00 đến 10.00 (BR-08) |
| `feedback` | TEXT | NULL | Lời nhận xét, góp ý của giảng viên |
| `graded_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Thời điểm chấm |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | Thời điểm sửa điểm |
| *CHECK* | - | `CHECK (score >= 0.00 AND score <= 10.00)` | Điểm hợp lệ trong đoạn [0, 10] |

---

### 2.3. Nhóm Module M3: Đề thi Trắc nghiệm & Tương tác (E4, E6)

#### 12. Bảng `quizzes` (Đề thi trắc nghiệm)
*Truy vết: US-10, BR-12, BR-13, BR-14, EC-07*
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | Mã đề thi |
| `course_id` | BIGINT | NOT NULL, FK -> `courses.id` (RESTRICT) | Thuộc khóa học |
| `title` | VARCHAR(200) | NOT NULL | Tên bài kiểm tra |
| `description` | TEXT | NULL | Hướng dẫn thi |
| `duration_minutes` | INT | NOT NULL | Thời lượng làm bài (phút) |
| `open_time` | DATETIME | NOT NULL | Thời điểm mở đề thi |
| `close_time` | DATETIME | NOT NULL | Thời điểm đóng đề thi |
| `show_score_immediately`| BOOLEAN | NOT NULL, DEFAULT TRUE | Xem điểm ngay sau khi nộp (US-12) |
| `status` | ENUM | NOT NULL, DEFAULT 'DRAFT' | Trạng thái: `DRAFT`, `PUBLISHED`, `CLOSED` |
| `has_attempts` | BOOLEAN | NOT NULL, DEFAULT FALSE | Đã có sinh viên thi (khóa sửa đề EC-07) |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Ngày tạo |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | Ngày cập nhật |
| `deleted_at` | DATETIME | NULL | Đánh dấu xóa mềm |
| *CHECK* | - | `CHECK (open_time < close_time)` | Giờ mở phải trước giờ đóng |
| *CHECK* | - | `CHECK (duration_minutes > 0)` | Thời lượng thi phải dương |

#### 13. Bảng `questions` (Câu hỏi trong đề thi trắc nghiệm)
*Truy vết: US-10, BR-12*
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | Mã câu hỏi |
| `quiz_id` | BIGINT | NOT NULL, FK -> `quizzes.id` (CASCADE) | Thuộc đề thi nào |
| `content` | TEXT | NOT NULL | Nội dung câu hỏi (đã sanitize XSS) |
| `order_index` | INT | NOT NULL, DEFAULT 1 | Thứ tự câu hỏi trong đề |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Ngày tạo |

#### 14. Bảng `options` (Lựa chọn trả lời cho câu hỏi)
*Truy vết: US-10, BR-12, Mục C.3*
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | Mã lựa chọn |
| `question_id` | BIGINT | NOT NULL, FK -> `questions.id` (CASCADE) | Thuộc câu hỏi nào |
| `content` | TEXT | NOT NULL | Nội dung lựa chọn (A, B, C, D) |
| `is_correct` | BOOLEAN | NOT NULL, DEFAULT FALSE | Đánh dấu đáp án đúng (tuyệt đối không gửi client khi thi EC-02) |
| `order_index` | INT | NOT NULL, DEFAULT 1 | Thứ tự hiển thị lựa chọn |

#### 15. Bảng `attempts` (Lượt làm bài thi trắc nghiệm của sinh viên)
*Truy vết: US-11, US-12, BR-14, BR-15, EC-06, EC-13, NFR-08*
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | Mã lượt thi |
| `quiz_id` | BIGINT | NOT NULL, FK -> `quizzes.id` (RESTRICT) | Đề thi trắc nghiệm |
| `student_id` | BIGINT | NOT NULL, FK -> `users.id` (RESTRICT) | Sinh viên thực hiện thi |
| `session_token` | VARCHAR(64) | NOT NULL | Token phiên làm bài, chống mở 2 tab (EC-13) |
| `started_at` | DATETIME | NOT NULL | Thời gian bắt đầu làm bài theo server |
| `expires_at` | DATETIME | NOT NULL | Thời gian hết hạn làm bài (`started_at + duration`) |
| `submitted_at` | DATETIME | NULL | Thời gian nộp bài thực tế |
| `total_questions` | INT | NOT NULL DEFAULT 0 | Tổng số câu hỏi của bài thi tại thời điểm thi |
| `correct_answers_count`| INT | NOT NULL DEFAULT 0 | Số lượng câu trả lời đúng |
| `score` | DECIMAL(4,2) | NULL | Điểm số tính theo thang 10 (Mục C.4) |
| `status` | ENUM | NOT NULL, DEFAULT 'IN_PROGRESS' | `IN_PROGRESS`, `SUBMITTED`, `AUTO_SUBMITTED` |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Ngày tạo bản ghi |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | Ngày cập nhật |
| *UNIQUE* | - | `UNIQUE KEY (quiz_id, student_id)` | Mỗi sinh viên chỉ được làm bài 1 lần duy nhất (BR-15) |

#### 16. Bảng `attempt_answers` (Chi tiết câu trả lời của lượt thi)
*Truy vết: US-11, US-12, EC-10*
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | Mã chi tiết câu trả lời |
| `attempt_id` | BIGINT | NOT NULL, FK -> `attempts.id` (CASCADE) | Thuộc lượt thi |
| `question_id` | BIGINT | NOT NULL, FK -> `questions.id` (RESTRICT) | Câu hỏi trả lời |
| `selected_option_id` | BIGINT | NULL, FK -> `options.id` (RESTRICT) | Đáp án sinh viên đã chọn (lưu ngầm khi auto-save) |
| `saved_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | Thời điểm lưu đáp án gần nhất |
| *UNIQUE* | - | `UNIQUE KEY (attempt_id, question_id)` | Mỗi câu hỏi trong 1 lượt thi chỉ lưu 1 đáp án đã chọn |

#### 17. Bảng `announcements` (Thông báo trong khóa học)
*Truy vết: US-15, BR-17, BR-18, EC-11*
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | Mã thông báo |
| `course_id` | BIGINT | NOT NULL, FK -> `courses.id` (CASCADE) | Khóa học nhận thông báo |
| `author_id` | BIGINT | NOT NULL, FK -> `users.id` (RESTRICT) | Người đăng (Giảng viên hoặc Admin) |
| `title` | VARCHAR(200) | NOT NULL | Tiêu đề thông báo |
| `content` | TEXT | NOT NULL | Nội dung chi tiết (đã sanitize XSS) |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Ngày đăng |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | Ngày sửa |

#### 18. Bảng `discussions` (Bình luận / Thảo luận bài học)
*Truy vết: US-16, BR-18, EC-11*
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | Mã bình luận |
| `course_id` | BIGINT | NOT NULL, FK -> `courses.id` (CASCADE) | Thuộc khóa học |
| `lesson_id` | BIGINT | NULL, FK -> `lessons.id` (SET NULL) | Thuộc bài học cụ thể (nếu có) |
| `author_id` | BIGINT | NOT NULL, FK -> `users.id` (RESTRICT) | Người viết bình luận |
| `content` | TEXT | NOT NULL | Nội dung thảo luận (đã sanitize XSS) |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Ngày viết |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | Ngày sửa |

#### 19. Bảng `notifications` (Hộp thư thông báo cá nhân)
*Truy vết: US-07, US-15, EC-24, Mục C.5*
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | Mã thông báo |
| `user_id` | BIGINT | NOT NULL, FK -> `users.id` (CASCADE) | Người nhận thông báo |
| `course_id` | BIGINT | NULL, FK -> `courses.id` (CASCADE) | Liên quan khóa học nào |
| `title` | VARCHAR(200) | NOT NULL | Tiêu đề tóm tắt |
| `content` | TEXT | NOT NULL | Nội dung ngắn gọn |
| `type` | ENUM | NOT NULL | `ASSIGNMENT_NEW`, `ANNOUNCEMENT_NEW`, `SCHEDULE_CHANGE`, `GRADE_RELEASED` |
| `is_read` | BOOLEAN | NOT NULL, DEFAULT FALSE | Đã đọc hay chưa |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Thời điểm gửi |

---

## 3. Chính sách Xóa Khóa ngoại (Foreign Key On Delete Actions)

Để ngăn ngừa mất mát dữ liệu quan trọng và hiện tượng dữ liệu mồ côi (EC-09), chính sách `ON DELETE` được quy định chặt chẽ:

| Quan hệ (Bảng cha $\rightarrow$ Bảng con) | Hành vi ON DELETE | Lý do kỹ thuật & nghiệp vụ |
|---|:---:|---|
| `roles` $\rightarrow$ `users` | **RESTRICT** | Không được xóa vai trò hệ thống khi còn tài khoản gắn với vai trò đó. |
| `users` $\rightarrow$ `courses` | **RESTRICT** | Không được xóa giảng viên khi họ đang là chủ sở hữu khóa học (phải chuyển giao hoặc xóa mềm). |
| `courses` $\rightarrow$ `enrollments` | **RESTRICT** | Khóa học đã có sinh viên ghi danh và học tập không được xóa cứng (bảo vệ lịch sử đào tạo EC-09). |
| `courses` $\rightarrow$ `assignments` | **RESTRICT** | Khóa học có bài tập đã giao không được xóa cứng. |
| `courses` $\rightarrow$ `quizzes` | **RESTRICT** | Khóa học có đề thi trắc nghiệm không được xóa cứng. |
| `assignments` $\rightarrow$ `submissions` | **RESTRICT** | Bài tập đã có bài làm nộp của sinh viên tuyệt đối không cho xóa cứng (EC-09). |
| `quizzes` $\rightarrow$ `attempts` | **RESTRICT** | Đề thi đã có sinh viên thi không được xóa cứng (bảo tồn điểm số). |
| `users` $\rightarrow$ `submissions` | **RESTRICT** | Sinh viên đã nộp bài không được xóa cứng khỏi database. |
| `users` $\rightarrow$ `attempts` | **RESTRICT** | Sinh viên đã có lượt thi trắc nghiệm không được xóa cứng. |
| `courses` $\rightarrow$ `lessons` | **CASCADE** | Xóa khóa học nháp chưa kích hoạt sẽ xóa sạch các bài giảng con. |
| `lessons` $\rightarrow$ `materials` | **CASCADE** | Xóa bài giảng thì tự động xóa các bản ghi tài liệu thuộc bài giảng đó. |
| `courses` $\rightarrow$ `schedules` | **CASCADE** | Xóa khóa học nháp sẽ xóa toàn bộ lịch học của khóa. |
| `quizzes` $\rightarrow$ `questions` | **CASCADE** | Xóa đề thi nháp sẽ tự động xóa câu hỏi thuộc đề thi đó. |
| `questions` $\rightarrow$ `options` | **CASCADE** | Xóa câu hỏi sẽ xóa toàn bộ các đáp án lựa chọn tương ứng. |
| `attempts` $\rightarrow$ `attempt_answers` | **CASCADE** | Xóa lượt thi sẽ xóa các đáp án đã chọn trong lượt đó. |
| `submissions` $\rightarrow$ `grades` | **CASCADE** | Bản ghi điểm tự luận gắn liền với bài nộp (1-1). |
| `users` $\rightarrow$ `refresh_tokens` | **CASCADE** | Khi xóa người dùng, toàn bộ token đăng nhập bị xóa theo. |
| `users` $\rightarrow$ `notifications` | **CASCADE** | Khi xóa người dùng, toàn bộ thông báo gửi tới họ bị xóa theo. |

---

## 4. Bảng Chỉ mục (Database Indexes) và Truy vết Truy vấn

Toàn bộ các chỉ mục được thiết lập dựa trên các câu truy vấn thực tế phát sinh từ User Stories, tránh tạo thừa gây giảm hiệu năng ghi:

| Tên chỉ mục | Bảng | Các cột được index | Phục vụ User Story & Truy vấn nghiệp vụ |
|---|---|---|---|
| `idx_users_username` | `users` | `(username)` | **US-01:** Xác thực đăng nhập qua username cực nhanh (NFR-01). |
| `idx_users_email` | `users` | `(email)` | **US-01, US-02:** Kiểm tra trùng email và đăng nhập bằng email. |
| `idx_courses_instructor` | `courses` | `(instructor_id)` | **US-03:** Giảng viên tải danh sách "Khóa học của tôi". |
| `idx_enrollments_student` | `enrollments` | `(student_id)` | **US-04:** Sinh viên tải danh sách "Khóa học đã tham gia". |
| `idx_enrollments_course_student` | `enrollments` | `(course_id, student_id)` | **US-14, EC-21:** Truy vấn bảng điểm tổng hợp của lớp, phân trang 20 sinh viên/trang kết hợp JOIN điểm số, triệt tiêu lỗi N+1 query. |
| `idx_lessons_course_order` | `lessons` | `(course_id, order_index)` | **US-05, US-06:** Lấy danh sách bài giảng theo đúng thứ tự hiển thị. |
| `idx_materials_lesson` | `materials` | `(lesson_id)` | **US-06:** Tải tài liệu đính kèm theo từng bài giảng. |
| `idx_schedules_course_date` | `schedules` | `(course_id, date, start_time)` | **US-17, US-18, EC-23:** Xem lịch học theo ngày và kiểm tra xung đột trùng giờ khi tạo buổi học mới. |
| `idx_assignments_course` | `assignments` | `(course_id, deadline)` | **US-07, US-08:** Danh sách bài tập cần nộp sắp xếp theo hạn chót. |
| `idx_submissions_assignment` | `submissions` | `(assignment_id, status)` | **US-09:** Giảng viên lọc danh sách bài tập cần chấm điểm. |
| `idx_submissions_student` | `submissions` | `(student_id)` | **US-13:** Sinh viên tra cứu điểm các bài tự luận đã nộp. |
| `idx_quizzes_course` | `quizzes` | `(course_id, status)` | **US-10, US-11:** Hiển thị danh sách đề thi đang mở cho sinh viên. |
| `idx_attempts_quiz_student` | `attempts` | `(quiz_id, student_id)` | **US-11, US-12, BR-15:** Kiểm tra sinh viên đã thi hay chưa và lấy kết quả lượt thi. |
| `idx_attempts_status_expires` | `attempts` | `(status, expires_at)` | **BR-14, Worker:** Tiến trình Cron nền quét nhanh các lượt thi quá hạn để tự động nộp bài (Auto-submit). |
| `idx_attempt_answers_attempt`| `attempt_answers`| `(attempt_id)` | **US-12:** Chấm điểm trắc nghiệm nhanh chóng bằng cách nạp toàn bộ câu trả lời của 1 lượt thi. |
| `idx_announcements_course` | `announcements` | `(course_id, created_at DESC)` | **US-15:** Bảng tin khóa học lấy thông báo mới nhất lên đầu. |
| `idx_discussions_course` | `discussions` | `(course_id, created_at DESC)` | **US-16:** Diễn đàn thảo luận tải bình luận mới nhất. |
| `idx_notifications_user` | `notifications` | `(user_id, is_read, created_at DESC)`| **US-07, US-15:** Lấy danh sách thông báo chưa đọc của người dùng. |

---

## 5. Danh mục các Nghiệp vụ Bắt buộc Dùng Database Transactions (ACID)

Nhằm đảm bảo tính toàn vẹn dữ liệu (NFR-08, EC-05), các quy trình nghiệp vụ sau bắt buộc phải được thực hiện trong 1 Transaction duy nhất (`BEGIN TRANSACTION ... COMMIT`):

1. **Nộp và Tự động Chấm điểm Bài thi Trắc nghiệm (US-12, NFR-08):**
   - Bước 1: Khóa bản ghi lượt thi `SELECT * FROM attempts WHERE id = ? FOR UPDATE`.
   - Bước 2: Kiểm tra trạng thái hiện tại phải là `IN_PROGRESS`.
   - Bước 3: Đọc đáp án chuẩn từ bảng `options` và đối chiếu với `attempt_answers`.
   - Bước 4: Tính tổng điểm và số câu đúng.
   - Bước 5: `UPDATE attempts SET status = 'SUBMITTED' (hoặc 'AUTO_SUBMITTED'), score = ?, correct_answers_count = ?, submitted_at = NOW() WHERE id = ?`.
   - Bước 6: `COMMIT`. Bất kỳ lỗi nào phát sinh đều `ROLLBACK`.

2. **Nộp lại Bài tập Tự luận (US-08, EC-04):**
   - Bước 1: Khóa bản ghi nộp bài `SELECT * FROM submissions WHERE assignment_id = ? AND student_id = ? FOR UPDATE`.
   - Bước 2: Cập nhật thông tin tệp mới, `submitted_at`, `is_late`, `late_minutes`, tăng `submission_count`.
   - Bước 3: `COMMIT`.

3. **Ghi danh Khóa học (US-04, EC-22):**
   - Bước 1: Kiểm tra mã khóa học `SELECT id FROM courses WHERE enrollment_key = ? AND status = 'PUBLISHED'`.
   - Bước 2: `INSERT INTO enrollments (course_id, student_id, enrolled_at) VALUES (?, ?, NOW())`.
   - Bước 3: Sinh thông báo chào mừng vào `notifications`.
   - Bước 4: `COMMIT`.

4. **Khóa Tài khoản và Thu hồi Phiên (US-02, EC-14):**
   - Bước 1: `UPDATE users SET status = 'LOCKED', token_version = token_version + 1 WHERE id = ?`.
   - Bước 2: `DELETE FROM refresh_tokens WHERE user_id = ?`.
   - Bước 3: `COMMIT`.

---

## 6. Kiến trúc Migration & Seed Theo Module (Database Migrations)

Cơ sở dữ liệu được quản lý theo mô hình **Modular Migrations** tuân thủ nguyên tắc độc lập giữa 3 thành viên, loại bỏ việc dùng chung một file `schema.sql` đơn khối:

### 6.1. Phân bổ Bảng theo Module (19 Bảng)
* **Module M1 (8 bảng):** `roles`, `users`, `refresh_tokens`, `courses`, `enrollments`, `lessons`, `materials`, `schedules`.
  * *Ghi chú:* Bảng `refresh_tokens` thuộc M1 vì gắn liền với vòng đời xác thực của thực thể `User`.
* **Module M2 (3 bảng):** `assignments`, `submissions`, `grades`.
  * *Ghi chú:* Chứa khóa ngoại trỏ tới `courses.id` và `users.id` của M1.
* **Module M3 (8 bảng):** `quizzes`, `questions`, `options`, `attempts`, `attempt_answers`, `announcements`, `discussions`, `notifications`.
  * *Ghi chú:* Bảng `notifications` thuộc M3 vì phục vụ nhóm chức năng Tương tác & Thông báo (E6), chứa khóa ngoại trỏ tới `users.id` và `courses.id` của M1.

### 6.2. Danh mục File Migrations (`database/migrations/`)
Được sắp xếp theo thứ tự timestamp đảm bảo bảng cha luôn được tạo trước bảng con:
1. `202611010900_m1_create_core_tables.sql` (8 bảng M1)
2. `202611011000_m2_create_assignment_tables.sql` (3 bảng M2)
3. `202611011100_m3_create_quiz_interaction_tables.sql` (8 bảng M3)

### 6.3. Danh mục File Seeds (`database/seeds/`)
1. `202611010900_m1_seed_core.sql` (Roles, Users mẫu, Course INT3101, Enrollments, Lessons, Materials, Schedules)
2. `202611011000_m2_seed_assignments.sql` (Assignment mẫu, Submission mẫu, Grade mẫu)
3. `202611011100_m3_seed_quizzes_interactions.sql` (Quiz 3 câu hỏi kèm 12 options, Announcements, Discussions, Notifications)

### 6.4. Công cụ Chạy Migration (`database/migrate.js`) & Lưu trữ Archive
* **Công cụ chạy:** `database/migrate.js` (chạy tuần tự, idempotent qua bảng `schema_migrations`) và `database/seed.js`.
* **File lưu trữ tham chiếu:** File `schema.sql` và `seed.sql` gốc được di chuyển an toàn vào `database/archive/schema.initial.sql` và `database/archive/seed.initial.sql` để bảo đảm tính duy nhất của nguồn sự thật (Single Source of Truth).


