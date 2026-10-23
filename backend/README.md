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

## M1 admin user management (PR 3)

- Admin-only routes under `/api/users` support paginated search/filter, account creation, role changes, status lock/unlock, and soft deletion.
- Account creation generates a cryptographically random initial password and stores only its bcrypt hash (work factor 10). The password is returned once in the create response for secure handoff and `must_change_password` is set; the API never logs the password.
- Locking, unlocking, changing a role, and soft deletion increment `token_version` and revoke refresh tokens in one transaction so existing access tokens cannot keep their old status or role.
- A user cannot lock their own account. Deleted accounts are excluded from search and authentication; user rows are never hard-deleted.
- The migration's `deleted_at`, `token_version`, `must_change_password`, role foreign key, and unique username/email columns already support this step; PR 3 adds no migration.

## M1 lessons and materials (PR 4)

- `POST /api/courses/:courseId/lessons` creates a lesson only for the owning instructor. `GET /api/courses/:courseId/lessons` lists accessible lessons and material metadata.
- `POST /api/lessons/:lessonId/materials` accepts multipart fields `title` and `file`; files are limited to 50 MiB and the `.pdf`, `.docx`, `.pptx`, `.zip`, and `.rar` allowlist. The shared storage helper checks magic bytes, stores a UUID filename outside the web root, and preserves the sanitized original filename as metadata.
- A file is removed immediately if its material row cannot be written. If immediate cleanup also fails, M1 logs and retries that known orphan through an `init(ctx)`-started job every 30 minutes. The retry queue is limited to failed M1 material writes so it never removes unrelated M2/M3 uploads from the shared storage root.
- `GET /api/courses/:courseId/materials/:materialId/download` verifies the course/material association and checks course ownership or student enrollment before opening the storage stream. Responses use attachment disposition with the original filename.
- Archived courses remain readable by authorized members, but lessons/materials cannot be added. No schema change was needed; the existing lessons/materials migration already contains all required columns.

## M1 schedules (PR 5)

- The owning instructor can list, create, edit, and cancel sessions through `/api/courses/:courseId/schedules` and `/api/schedules/:scheduleId`. Cancellation changes the existing row to `CANCELLED`; it does not delete it.
- Dates must be valid `YYYY-MM-DD` values and times must satisfy `startTime < endTime`. Rescheduling marks the session `RESCHEDULED`; title/location-only edits preserve its current active status.
- Schedule writes run in a transaction and lock the owning course row before checking same-day overlaps. This serializes concurrent schedule writes for a course; cancelled sessions do not block a new session.
- After each committed create, update, or first cancellation, M1 resolves `notifications` with `{ optional: true }` and requests a `SCHEDULE_CHANGED` notification. The Port is optional until M3 provides it; notification failures are logged and do not undo a committed schedule change.
- The existing M1 core migration already defines the `schedules` table, status enum, and `start_time < end_time` constraint, so this PR requires no migration.

## M1 timetable viewing (PR 6)

- `GET /api/courses/:courseId/schedules` is available only to the course owner and students enrolled in that course; an un-enrolled student or unrelated caller is forbidden.
- `GET /api/me/schedule?page=1&limit=20` returns a date/time-ordered, paginated timetable across the authenticated student's enrolled courses. The page size is limited to 100.
- Cancelled sessions are excluded from course and combined timetable views. The combined query scopes both its count and returned rows to the student's enrollment records; no cross-module tables or schema changes are needed.
