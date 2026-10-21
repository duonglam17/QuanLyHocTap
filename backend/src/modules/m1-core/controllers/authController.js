class AuthController {
  constructor(authService) {
    this.authService = authService;
  }

  async login(req, res, next) {
    try {
      const tokens = await this.authService.login(req.body || {});
      return res.status(200).json(tokens);
    } catch (error) {
      return next(error);
    }
  }

  async refresh(req, res, next) {
    try {
      const tokens = await this.authService.refresh(req.body || {});
      return res.status(200).json(tokens);
    } catch (error) {
      return next(error);
    }
  }

  async logout(req, res, next) {
    try {
      await this.authService.logout(req.user.id);
      return res.status(204).end();
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = AuthController;
