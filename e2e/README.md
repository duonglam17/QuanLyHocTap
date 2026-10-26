# LMS Mini E2E

Playwright E2E tests run from this isolated package; backend and frontend manifests are not modified.

## Requirements

- Node.js 20 or later
- MySQL 8 with permission to drop and create the dedicated `lms_e2e` database
- Dependencies installed in `backend/`, `frontend/`, and `e2e/`

From the repository root on Windows PowerShell:

```powershell
Copy-Item e2e\e2e.env.example e2e\.env.e2e
# Edit DB_ADMIN_PASSWORD and DB_PASSWORD if your local MySQL root password differs.
npm ci --prefix backend
npm ci --prefix frontend
npm ci --prefix e2e
npx --prefix e2e playwright install chromium
```

Do not point `DB_NAME` at a development database. The reset script refuses to alter anything except `lms_e2e`. The sample MySQL password matches the local-only default in `docker-compose.yml`; replace it if your MySQL server uses a different credential.

## Database

Reset the E2E database, then apply the repository's existing migrations and seeds:

```powershell
npm run db:reset --prefix e2e
```

The reset operation drops and recreates only `lms_e2e`, and calls `database/migrate.js` and `database/seed.js`. To seed or migrate separately:

```powershell
npm run db:migrate --prefix e2e
npm run db:seed --prefix e2e
```

Set `E2E_RESET_DB=1` before Playwright to run the reset automatically before the backend starts:

```powershell
$env:E2E_RESET_DB = '1'
npm test --prefix e2e
Remove-Item Env:E2E_RESET_DB
```

The E2E server uses ports 5001 and 5174 by default and proxies frontend `/api` requests to the E2E backend. It will not reuse an already-running server unless `E2E_REUSE_SERVERS=1` is explicitly set.

## Run tests and inspect failures

```powershell
npm run test:smoke --prefix e2e
npm test --prefix e2e
npm run test:ui --prefix e2e
npm run test:headed --prefix e2e
npm run report --prefix e2e
```

Install the optional Firefox browser and set `E2E_FIREFOX=1` to add its project:

```powershell
npx --prefix e2e playwright install firefox
$env:E2E_FIREFOX = '1'
npm test --prefix e2e
Remove-Item Env:E2E_FIREFOX
```

Traces are captured on the first retry, screenshots on failures, and the HTML report is written under `e2e/.generated/report`.

Seed login accounts (from `database/seeds/202611010900_m1_seed_core.sql`):

| Role | Username | Password |
|---|---|---|
| ADMIN | `admin` | `MatKhau@123` |
| GIANG_VIEN | `gv_mai` | `MatKhau@123` |
| SINH_VIEN | `sv_nam` | `MatKhau@123` |

`fixtures/auth.js` provides API login and saves role-specific storage state files under `e2e/.generated/auth`. `fixtures/api.js` provides authenticated course creation and student enrollment helpers. `fixtures/uploads.js` creates small PDF/ZIP, disallowed-extension, and oversized upload files.

## Spec ownership

- `specs/smoke.spec.js`: shared authentication smoke checks.
- `specs/e1-giang-day.spec.js`: A — teaching, course, lesson, schedule, and materials flow.
- `specs/e2-bai-tap.spec.js`: B — assignment submission, grading, personal grades, and class gradebook.
- `specs/e3-trac-nghiem.spec.js`: C — quiz authoring, attempt, autosave, and published result.

The PRD currently labels the three user journeys as DoD scenarios (1), (2), and (3), rather than literal `E2E-1`, `E2E-2`, and `E2E-3` headings. The spec ownership above maps to those DoD flows.
