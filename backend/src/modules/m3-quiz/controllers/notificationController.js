function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function createNotificationController(service) {
  return {
    list: asyncHandler(async (req, res) => {
      const result = await service.getNotifications(req.user.id, req.query);
      res.status(200).json(result);
    }),

    markRead: asyncHandler(async (req, res) => {
      const result = await service.markNotificationRead(
        req.params.notificationId,
        req.user.id
      );
      res.status(200).json(result);
    })
  };
}

module.exports = createNotificationController;
