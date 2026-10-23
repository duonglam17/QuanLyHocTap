function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function createAnnouncementController(service) {
  return {
    create: asyncHandler(async (req, res) => {
      const announcement = await service.create(
        req.params.courseId,
        req.user.id,
        req.user.role,
        req.body
      );
      res.status(201).json(announcement);
    }),

    list: asyncHandler(async (req, res) => {
      const result = await service.list(
        req.params.courseId,
        req.user.id,
        req.user.role,
        req.query
      );
      res.status(200).json(result);
    }),

    delete: asyncHandler(async (req, res) => {
      const result = await service.delete(
        req.params.announcementId,
        req.user.id,
        req.user.role
      );
      res.status(200).json(result);
    })
  };
}

module.exports = createAnnouncementController;
