export const statusEntries = {
  account: [
    ['ACTIVE', 'Đang hoạt động', 'success'],
    ['LOCKED', 'Đã khóa', 'destructive'],
    ['TEMPORARY_LOCKED', 'Tạm khóa', 'warning']
  ],
  course: [
    ['DRAFT', 'Bản nháp', 'secondary'],
    ['PUBLISHED', 'Đang mở', 'success'],
    ['ARCHIVED', 'Đã lưu trữ', 'outline']
  ],
  assignment: [
    ['OPEN', 'Đang nhận bài', 'success'],
    ['CLOSED', 'Đã đóng', 'outline'],
    ['ARCHIVED', 'Đã lưu trữ', 'outline']
  ],
  submission: [
    ['NOT_SUBMITTED', 'Chưa nộp', 'secondary'],
    ['SUBMITTED', 'Đã nộp', 'success'],
    ['SUBMITTED_LATE', 'Nộp trễ', 'warning'],
    ['GRADED', 'Đã chấm', 'default']
  ],
  attempt: [
    ['IN_PROGRESS', 'Đang làm', 'warning'],
    ['SUBMITTED', 'Đã nộp', 'success'],
    ['AUTO_SUBMITTED', 'Tự động nộp', 'secondary']
  ],
  schedule: [
    ['SCHEDULED', 'Đã lên lịch', 'default'],
    ['RESCHEDULED', 'Đã đổi lịch', 'warning'],
    ['CANCELLED', 'Đã hủy', 'destructive']
  ],
  quiz: [
    ['DRAFT', 'Bản nháp', 'secondary'],
    ['PUBLISHED', 'Đang mở', 'success'],
    ['CLOSED', 'Đã đóng', 'outline']
  ]
};

export const statusLabels = Object.fromEntries(
  Object.entries(statusEntries).map(([type, entries]) => [
    type,
    Object.fromEntries(entries.map(([value, label, variant]) => [value, [label, variant]]))
  ])
);
