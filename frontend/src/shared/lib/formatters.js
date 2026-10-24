const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Ho_Chi_Minh'
});

const scoreFormatter = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 2
});

export function formatDateTime(iso) {
  if (!iso) return 'Chưa có';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 'Thời gian không hợp lệ' : dateTimeFormatter.format(date);
}

export function formatScore(value) {
  return value === null || value === undefined ? 'Chưa có' : scoreFormatter.format(value);
}

export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return 'Không xác định';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = bytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(size)} ${units[unitIndex]}`;
}
