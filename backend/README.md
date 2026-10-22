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

Versions are recorded in `package.json`/`package-lock.json`. PR 1 verifies stored password hashes with `bcrypt`.

## Inter-module contracts

See [`docs/contracts.md`](../docs/contracts.md) for the shared infrastructure and inter-module contract source of truth. The registry rejects duplicate registrations and throws for a missing required Port; `getPort(name, { optional: true })` returns `null`.

### Usage Ports

- `assessmentUsage` (provided by M2) and `quizUsage` (provided by M3) each expose `hasCourseData(courseId)` and `hasUserData(userId)`.
- M1 should resolve both with `getPort(name, { optional: true })`; a missing Port must be treated as existing data, allowing only archive or soft-delete behavior.

## Configuration and storage notes

`.env.example` contains local-only placeholder values, not deployable credentials. Production must supply its own `JWT_SECRET` and database credentials. MySQL pool sizing is restricted to the architecture's 10–30 connection range. Upload storage defaults to `backend/uploads`, is not exposed as a static route, uses UUID filenames, and validates both supported extensions and detected magic bytes. The storage helper removes any partial file if a write or rename fails.

PR 0 provides the shared scaffold. PR 1 implements M1 authentication; course and user-management workflows remain in their ordered steps.

## M1 authentication (PR 1)

- `POST /api/auth/login` accepts `{ "username": "...", "password": "..." }`; the identifier can be a username or email.
- Successful authentication returns an access JWT (15 minutes), a one-time refresh token (7 days), and the user's role/password-change flag. Only a SHA-256 hash of the refresh token is stored.
- `POST /api/auth/refresh` rotates a valid refresh token. `POST /api/auth/logout` increments `token_version` and removes all refresh tokens for the authenticated user.
- Login is limited to five requests per minute per IP. Five consecutive wrong passwords in a ten-minute window temporarily lock the account for 15 minutes. Unknown users and incorrect passwords receive the same response.
- Apply `database/migrations/202611011000_m1_add_login_failure_window.sql` after the M1 core migration to persist the start of the failed-login window.

## M1 courses and enrollment (PR 2)

- `POST /api/courses` creates an instructor-owned `DRAFT` course. A unique six-character uppercase alphanumeric enrollment key is generated unless the instructor supplies a case-sensitive 6-8 character key.
- Instructors can list, view, update, and publish their courses. Students see courses they joined; enrollment keys are not returned in student course views. Owners and admins can archive a course.
- `DELETE /api/courses/:courseId` never hard-deletes: empty courses are soft-deleted, while courses with M1 content/enrollments or assessment/quiz records are archived.
- Students join using `POST /api/courses/enroll` with `enrollment_key`. The key comparison is case-sensitive; only published courses accept enrollments. The endpoint is limited to five attempts per IP per minute.
- An instructor or admin can remove a student using `DELETE /api/courses/:courseId/enrollments/:studentId` only when both optional usage Ports confirm the student has no assessment or quiz records. Missing usage providers conservatively block removal.
- M1 registers the real `courseAccess` Port during module `init(ctx)`; consumers resolve it through the app's contract registry while handling requests.
