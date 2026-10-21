# M3 - Repositories (Tầng Truy vấn Dữ liệu CSDL)

Chứa các truy vấn SQL tới những bảng do M3 sở hữu:

- `quizRepository.js`: Đề thi, câu hỏi và lựa chọn.
- `attemptRepository.js`: Lượt thi, đáp án đã lưu và kết quả chấm.
- `communicationRepository.js`: Thông báo khóa học, thảo luận và thông báo cá nhân.

Repository chỉ truy cập dữ liệu; không chứa logic nghiệp vụ hoặc phụ thuộc vào tầng Service hay Controller. Module khác không truy cập trực tiếp repository của M3.
