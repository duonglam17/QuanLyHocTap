import { useState } from 'react';
import { PageHeader } from '../../../shared/components/molecules/PageHeader.jsx';
import { Pagination } from '../../../shared/components/molecules/Pagination.jsx';
import { DataState } from '../../../shared/components/organisms/DataState.jsx';
import { toast } from '../../../shared/components/molecules/Toast.jsx';
import { useApiMutation } from '../../../shared/hooks/useApiMutation.js';
import { useApiQuery } from '../../../shared/hooks/useApiQuery.js';
import { listNotifications, markNotificationRead } from '../api/notifications.js';
import { NotificationItem } from '../components/NotificationItem.jsx';

const pageSize = 20;

export function NotificationsPage() {
  const [page, setPage] = useState(1);
  const queryKey = ['m3', 'notifications', 'page', page, pageSize];
  const query = useApiQuery(queryKey, () => listNotifications({ page, limit: pageSize }));
  const markRead = useApiMutation(markNotificationRead, {
    invalidate: [queryKey]
  });

  async function handleMarkRead(notification) {
    try {
      await markRead.mutate(notification.id);
      toast.success('Đã đánh dấu thông báo là đã đọc.');
    } catch (error) {
      toast.error(error.message || 'Không thể đánh dấu thông báo đã đọc.');
    }
  }

  return (
    <section className="grid gap-6">
      <PageHeader
        description="Xem và quản lý thông báo của bạn."
        title="Thông báo"
      />
      <DataState
        empty={{
          title: 'Chưa có thông báo',
          description: 'Thông báo mới sẽ xuất hiện tại đây.'
        }}
        isEmpty={(data) => !data?.items?.length}
        loading={
          <div aria-label="Đang tải thông báo" className="grid gap-3">
            <div className="h-28 animate-pulse rounded-lg bg-muted" />
            <div className="h-28 animate-pulse rounded-lg bg-muted" />
            <div className="h-28 animate-pulse rounded-lg bg-muted" />
          </div>
        }
        query={query}
      >
        {(data) => (
          <div className="grid gap-4">
            <div aria-live="polite" className="grid gap-3">
              {data.items.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  marking={markRead.status === 'loading'}
                  notification={notification}
                  onMarkRead={handleMarkRead}
                />
              ))}
            </div>
            <Pagination
              disabled={query.status === 'loading'}
              onPageChange={setPage}
              page={data.page}
              totalPages={Math.max(1, Math.ceil(data.total / data.limit))}
            />
          </div>
        )}
      </DataState>
    </section>
  );
}
