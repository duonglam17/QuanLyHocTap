import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../../../shared/components/atoms/DropdownMenu.jsx';
import { Button } from '../../../shared/components/atoms/Button.jsx';
import { ErrorState } from '../../../shared/components/organisms/ErrorState.jsx';
import { Skeleton } from '../../../shared/components/atoms/Skeleton.jsx';
import { toast } from '../../../shared/components/molecules/Toast.jsx';
import { getSafeRedirectPath } from '../../../shared/lib/redirects.js';
import { useApiQuery } from '../../../shared/hooks/useApiQuery.js';
import { listNotifications, markNotificationRead } from '../api/notifications.js';

const queryKey = ['m3', 'notifications', 'bell'];
const refreshIntervalMs = 60_000;
const unreadLimit = 100;

export function NotificationBell() {
  const navigate = useNavigate();
  const [markingId, setMarkingId] = useState(null);
  const query = useApiQuery(queryKey, () => listNotifications({ page: 1, limit: unreadLimit }));
  const { refetch } = query;
  const notifications = query.data?.items ?? [];
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  useEffect(() => {
    function refreshIfVisible() {
      if (document.visibilityState === 'visible') {
        refetch().catch(() => {});
      }
    }

    const intervalId = window.setInterval(refreshIfVisible, refreshIntervalMs);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [refetch]);

  async function handleSelect(notification) {
    if (!notification.isRead) {
      setMarkingId(notification.id);
      try {
        await markNotificationRead(notification.id);
        await query.refetch();
      } catch (error) {
        toast.error(error.message || 'Không thể đánh dấu thông báo đã đọc.');
      } finally {
        setMarkingId(null);
      }
    }

    const safeLink = getSafeRedirectPath(notification.link);
    if (safeLink) navigate(safeLink);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Thông báo, ${unreadCount} chưa đọc trong 100 thông báo gần nhất`}
          className="relative"
          size="icon"
          variant="ghost"
        >
          <Bell aria-hidden="true" className="size-5" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-destructive px-1 text-center text-xs leading-5 text-destructive-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-2rem))]">
        <DropdownMenuLabel className="flex items-center justify-between gap-3">
          <span>Thông báo</span>
          <Button
            onClick={() => navigate('/notifications')}
            size="sm"
            variant="ghost"
          >
            Xem tất cả
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {query.status === 'loading' && !query.data ? (
          <div aria-label="Đang tải thông báo" className="grid gap-2 p-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : null}
        {query.status === 'error' && !query.data ? (
          <div className="max-w-sm p-2">
            <ErrorState
              message={query.error?.message}
              onRetry={() => query.refetch().catch(() => {})}
            />
          </div>
        ) : null}
        {query.status === 'error' && query.data ? (
          <div className="p-2" role="alert">
            <p className="text-sm text-destructive">
              Không thể làm mới thông báo: {query.error?.message}
            </p>
            <Button
              onClick={() => query.refetch().catch(() => {})}
              size="sm"
              variant="outline"
            >
              Thử lại
            </Button>
          </div>
        ) : null}
        {query.status === 'success' && notifications.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Chưa có thông báo.</p>
        ) : null}
        {query.data?.items?.length > 0 ? (
          <div className="max-h-96 overflow-y-auto">
            {query.data.items.slice(0, 10).map((notification) => (
              <DropdownMenuItem
                className="items-start whitespace-normal py-3"
                disabled={markingId === notification.id}
                key={notification.id}
                onSelect={() => handleSelect(notification)}
              >
                <div className="grid min-w-0 gap-1">
                  <span className="font-medium">{notification.title}</span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">
                    {notification.message}
                  </span>
                  {!notification.isRead ? (
                    <span className="text-xs font-medium text-primary">Chưa đọc</span>
                  ) : null}
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
