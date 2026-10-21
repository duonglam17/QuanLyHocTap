import { StatusMessage } from '../molecules/StatusMessage.jsx';

export function LoadingState({ message = 'Đang tải dữ liệu...' }) {
  return <StatusMessage title="Đang tải">{message}</StatusMessage>;
}
