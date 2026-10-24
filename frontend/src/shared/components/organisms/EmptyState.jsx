import { StatusMessage } from '../molecules/StatusMessage.jsx';
import { Button } from '../atoms/Button.jsx';

export function EmptyState({
  title = 'Chưa có dữ liệu',
  description = 'Chưa có dữ liệu để hiển thị.',
  message,
  action
}) {
  return (
    <StatusMessage title={title}>
      {message ?? description}
      {action
        ? typeof action === 'object' && action.label
          ? <Button className="mt-4" onClick={action.onClick}>{action.label}</Button>
          : <div className="mt-4">{action}</div>
        : null}
    </StatusMessage>
  );
}
