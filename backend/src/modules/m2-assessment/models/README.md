# M2 - Models (Tầng Thực thể & Cấu trúc Dữ liệu)

Định nghĩa cấu trúc dữ liệu và schema các thực thể thuộc Module M2:

- `Assignment`: id, course_id, title, description, deadline, max_score, allow_late, status ('OPEN', 'CLOSED').
- `Submission`: id, assignment_id, student_id, original_filename, file_uuid, file_path, file_size_bytes, mime_type, submitted_at, is_late, late_minutes, submission_count, status ('SUBMITTED', 'SUBMITTED_LATE', 'GRADED').
- `Grade`: id, submission_id, graded_by, score, feedback, graded_at, updated_at.

