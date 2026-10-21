# LMS Mini backend foundation (PR 0)

## Requirements and startup

- Node.js 20 or later
- Docker Compose v2 for the full local stack

From the repository root:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

The compose file initializes MySQL from the existing module migrations and seeds. The API listens on `http://localhost:5000`.

To run the backend directly from `backend/`, start MySQL separately, copy the repository `.env.example` to `.env`, then run:

```powershell
npm ci
npm run dev
```

Useful checks from `backend/`:

```powershell
npm test
npm run lint
npm run deps:check
```

The health check is `GET /api/health`; Swagger UI is at `/api-docs`. The generated ping paths remain `GET /api/m1-core/ping`, `GET /api/m2-assessment/ping`, and `GET /api/m3-quiz/ping`.

## Module loading and route rules

`src/app.js` discovers each immediate directory under `src/modules`, loads its `index.js`, calls an optional synchronous `init(ctx)`, and mounts all module routes at `/api` without a directory prefix. Each module must export an Express router directly or as `{ router, init }`. `init` can register resources in `ctx.contracts`; the context also exposes `app`, `common`, `config`, `db`, and `logger`.

At startup, the loader inventories router methods and paths (including nested routers), normalizes parameter names, and throws if two modules claim the same method and path. The legacy module `/ping` route is kept at `/api/<module-directory>/ping` and is excluded from the flattened module route table.

## Shared dependency choices

- `jsonwebtoken`: verifies bearer access tokens and is the agreed JWT implementation for M1.
- `bcrypt`: password hashing interface for M1; do not store plaintext passwords.
- `zod`: request validation schemas and structured validation errors.
- `multer`: multipart upload parsing for M1/M2 file endpoints.
- `file-type`: inspect file magic bytes alongside an extension allowlist.
- `express-rate-limit`: shared IP-based rate-limit middleware.
- `helmet` and the existing `cors`: common HTTP security headers and origin policy.
- `sanitize-html`: shared XSS sanitization helper.
- `node-cron`: scheduled jobs used by later module steps.
- `swagger-ui-express` and `yaml`: render and parse the common, M1, M2, and M3 OpenAPI files.
- `supertest`: HTTP integration tests without starting a separately managed server.

Versions are recorded in `package.json`/`package-lock.json`. Verify that `bcrypt` hashing and comparison work in the target runtime before using password hashing in PR 1.

## Inter-module contracts

See [`docs/contracts.md`](../docs/contracts.md) for the shared infrastructure and inter-module contract source of truth. The registry rejects duplicate registrations and throws for a missing required Port; `getPort(name, { optional: true })` returns `null`.

## Configuration and storage notes

`.env.example` contains local-only placeholder values, not deployable credentials. Production must supply its own `JWT_SECRET` and database credentials. MySQL pool sizing is restricted to the architecture's 10–30 connection range. Upload storage defaults to `backend/uploads`, is not exposed as a static route, uses UUID filenames, and validates both supported extensions and detected magic bytes. The storage helper removes any partial file if a write or rename fails.

PR 0 does not implement user/course business workflows or DB-backed token-version checks. Those belong to the ordered M1 steps.
