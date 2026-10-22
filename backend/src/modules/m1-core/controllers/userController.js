class UserController {
  constructor(userService) {
    this.userService = userService;
  }

  async list(req, res, next) {
    try {
      const result = await this.userService.listUsers(req.query);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }

  async create(req, res, next) {
    try {
      const result = await this.userService.createUser(req.body);
      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const user = await this.userService.updateUserStatus(
        req.params.userId,
        req.body.status,
        req.user.id
      );
      return res.status(200).json({ user });
    } catch (error) {
      return next(error);
    }
  }

  async updateRole(req, res, next) {
    try {
      const user = await this.userService.updateUserRole(req.params.userId, req.body.role);
      return res.status(200).json({ user });
    } catch (error) {
      return next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await this.userService.deleteUser(req.params.userId);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = UserController;
