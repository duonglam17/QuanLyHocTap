/**
 * =============================================================================
 * DEPENDENCY CRUISER CONFIGURATION (.dependency-cruiser.js)
 * =============================================================================
 * Kiểm tra và bảo vệ chiều phụ thuộc kiến trúc theo docs/architecture.md:
 * 1. Không có import vòng tròn (no-circular).
 * 2. Chiều phụ thuộc một chiều: Controller -> Service -> Repository -> Model/DB.
 *    - Controller CẤM gọi trực tiếp Repository.
 *    - Service CẤM gọi Controller.
 *    - Repository/Model CẤM gọi Service hoặc Controller.
 * 3. Module isolation:
 *    - Module này CẤM import trực tiếp Repository/Model/Controller của module khác.
 *    - Giao tiếp giữa các module chỉ thông qua Service hoặc thư mục contracts/.
 * =============================================================================
 */

module.exports = {
  forbidden: [
    /* 1. Ngăn chặn import vòng tròn */
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Cấm import vòng tròn giữa các module hoặc file trong dự án.',
      from: {},
      to: {
        circular: true
      }
    },

    /* 2. Controller không được import Repository trực tiếp */
    {
      name: 'controller-no-repository',
      severity: 'error',
      comment: 'Controller phải gọi qua Service, không được import trực tiếp Repository.',
      from: {
        path: '^src/modules/[^/]+/controllers'
      },
      to: {
        path: '^src/modules/[^/]+/repositories'
      }
    },

    /* 3. Service không được import Controller */
    {
      name: 'service-no-controller',
      severity: 'error',
      comment: 'Service không được phụ thuộc ngược lên tầng Controller.',
      from: {
        path: '^src/modules/[^/]+/services'
      },
      to: {
        path: '^src/modules/[^/]+/controllers'
      }
    },

    /* 4. Repository/Model không được import Service hoặc Controller */
    {
      name: 'lower-not-import-upper',
      severity: 'error',
      comment:
        'Tầng dữ liệu (Repository, Model) không được import tầng trên (Service, Controller).',
      from: {
        path: '^src/modules/[^/]+/(repositories|models)'
      },
      to: {
        path: '^src/modules/[^/]+/(services|controllers)'
      }
    },

    /* 5. Cách ly giữa các module: Không import trực tiếp tầng dữ liệu/controller của module khác */
    {
      name: 'no-cross-module-internals',
      severity: 'error',
      comment:
        'Module này không được import trực tiếp Repository, Model hoặc Controller của module khác.',
      from: {
        path: '^src/modules/(?<moduleName>[^/]+)'
      },
      to: {
        path: '^src/modules/(?!\\k<moduleName>)[^/]+/(repositories|models|controllers)'
      }
    }
  ],
  options: {
    doNotFollow: {
      path: 'node_modules'
    },
    reporterOptions: {
      text: {
        highlightFocused: true
      }
    }
  }
};
