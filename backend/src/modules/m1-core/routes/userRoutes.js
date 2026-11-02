const { Router } = require('express');
const { z } = require('zod');
const { requireAuth, requireRole, validate, ForbiddenError } = require('../../../common');

const roleSchema = z.enum(['ADMIN', 'GIANG_VIEN', 'SINH_VIEN']);
const statusSchema = z.enum(['ACTIVE', 'LOCKED']);
const userIdSchema = z.string().regex(/^[1-9]\d*$/);

function createUserRouter({ userController } = {}) {
  if (!userController) {
    throw new TypeError('createUserRouter yêu cầu UserController.');
  }
  const router = Router();

  // GET /api/users/me: Chỉ dành cho GIANG_VIEN và SINH_VIEN
  router.get(
    '/me',
    requireAuth,
    (req, _res, next) => {
      if (req.user?.role === 'ADMIN') {
        throw new ForbiddenError('Quản trị viên không có quyền xem trang này');
      }
      next();
    },
    userController.getMe.bind(userController)
  );

  // PUT /api/users/me/password: Đổi mật khẩu cá nhân cho GIANG_VIEN và SINH_VIEN
  router.put(
    '/me/password',
    requireAuth,
    (req, _res, next) => {
      if (req.user?.role === 'ADMIN') {
        throw new ForbiddenError('Quản trị viên không có quyền xem trang này');
      }
      next();
    },
    userController.changePassword.bind(userController)
  );

  // Mọi route quản trị người dùng bên dưới bắt buộc quyền ADMIN
  router.use(requireAuth, requireRole('ADMIN'));

  const listSchema = z.object({
    query: z.object({
      search: z.string().trim().max(100).optional(),
      role: roleSchema.optional(),
      status: z.enum(['ACTIVE', 'LOCKED', 'TEMPORARY_LOCKED']).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20)
    })
  });
  const createSchema = z.object({
    body: z.object({
      fullName: z.string().trim().min(1).max(100),
      username: z.string().trim().min(1).max(50),
      email: z.string().trim().email().max(100),
      role: roleSchema
    })
  });
  const statusUpdateSchema = z.object({
    params: z.object({ userId: userIdSchema }),
    body: z.object({ status: statusSchema })
  });
  const roleUpdateSchema = z.object({
    params: z.object({ userId: userIdSchema }),
    body: z.object({ role: roleSchema })
  });
  const userParamSchema = z.object({ params: z.object({ userId: userIdSchema }) });

  router.get('/', validate(listSchema), userController.list.bind(userController));
  router.post('/', validate(createSchema), userController.create.bind(userController));
  router.patch(
    '/:userId/status',
    validate(statusUpdateSchema),
    userController.updateStatus.bind(userController)
  );
  router.patch(
    '/:userId/role',
    validate(roleUpdateSchema),
    userController.updateRole.bind(userController)
  );
  router.delete('/:userId', validate(userParamSchema), userController.delete.bind(userController));
  return router;
}

module.exports = { createUserRouter };
