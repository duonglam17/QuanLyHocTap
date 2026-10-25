import { api } from '../../../shared/api/client.js';

export function listNotifications({ page = 1, limit = 20 } = {}) {
  return api.get('/notifications', { params: { page, limit } });
}

export function markNotificationRead(notificationId) {
  return api.patch(`/notifications/${encodeURIComponent(notificationId)}/read`);
}
