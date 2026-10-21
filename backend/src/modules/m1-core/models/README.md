# M1 - Models (Tầng Thực thể & Cấu trúc Dữ liệu)

Định nghĩa cấu trúc dữ liệu và schema các thực thể thuộc Module M1 (khớp 100% với schema CSDL và ERD):

- `Role`: id, name ('ADMIN', 'GIANG_VIEN', 'SINH_VIEN'), description, created_at.
- `User`: id, role_id, username, email, password_hash, full_name, status, failed_login_attempts, lockout_until, token_version, must_change_password.
- `RefreshToken`: id, user_id, token_hash, expires_at.
- `Course`: id, code, title, description, semester, instructor_id, enrollment_key, status.
- `Enrollment`: id, course_id, student_id, enrolled_at.
- `Lesson`: id, course_id, title, content, order_index.
- `Material`: id, lesson_id, title, original_filename, file_uuid, file_path, file_size_bytes, mime_type.
- `Schedule`: id, course_id, title, date, start_time, end_time, room_or_link, status.

