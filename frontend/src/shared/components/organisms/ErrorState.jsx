import { Button } from '../atoms/Button.jsx';
import { StatusMessage } from '../molecules/StatusMessage.jsx';

export function ErrorState({ message = 'Đã xảy ra lỗi.', onRetry }) {
  return (
    <StatusMessage title="Không thể tải dữ liệu" role="alert">
      <span>{message}</span>
      {onRetry ? (
        <Button className="mt-4" onClick={onRetry} variant="outline">
          Thử lại
        </Button>
      ) : null}
    </StatusMessage>
  );
}
