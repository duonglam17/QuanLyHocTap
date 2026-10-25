import { Link } from 'react-router-dom';
import { Button } from '../../../shared/components/atoms/Button.jsx';
import { formatDateTime } from '../../../shared/lib/formatters.js';
import { getSafeRedirectPath } from '../../../shared/lib/redirects.js';

export function NotificationItem({ notification, onMarkRead, marking = false }) {
  const safeLink = getSafeRedirectPath(notification.link);

  return (
    <article
      className={`grid gap-2 rounded-lg border p-4 ${
        notification.isRead ? 'border-border bg-card' : 'border-primary/30 bg-primary/5'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-medium">{notification.title}</h2>
        <time
          className="text-xs text-muted-foreground"
          dateTime={notification.createdAt}
        >
          {formatDateTime(notification.createdAt)}
        </time>
      </div>
      <p className="whitespace-pre-wrap text-sm text-muted-foreground">
        {notification.message}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {!notification.isRead ? (
          <span className="text-xs font-medium text-primary">Chưa đọc</span>
        ) : null}
        {safeLink ? (
          <Link
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            to={safeLink}
          >
            Mở thông báo
          </Link>
        ) : null}
        {!notification.isRead ? (
          <Button
            disabled={marking}
            onClick={() => onMarkRead(notification)}
            size="sm"
            variant="outline"
          >
            Đánh dấu đã đọc
          </Button>
        ) : null}
      </div>
    </article>
  );
}
