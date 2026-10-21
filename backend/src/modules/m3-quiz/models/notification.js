function mapNotificationRow(row) {
  return {
    id: row.id,
    userId: row.userId,
    courseId: row.courseId,
    title: row.title,
    message: row.message,
    type: row.type,
    refType: row.refType,
    refId: row.refId,
    link: row.link,
    isRead: Boolean(row.isRead),
    createdAt: row.createdAt
  };
}

module.exports = { mapNotificationRow };
