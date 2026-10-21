import { StatusMessage } from '../molecules/StatusMessage.jsx';

export function EmptyState({ message = 'Chưa có dữ liệu để hiển thị.' }) {
  return <StatusMessage title="Chưa có dữ liệu">{message}</StatusMessage>;
}
