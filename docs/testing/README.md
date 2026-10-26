# LMS Mini test workflow

Run validation serially from the repository root. E2E uses a dedicated database, separate from the development database.

## Install dependencies

```powershell
npm ci --prefix backend
npm ci --prefix frontend
npm ci --prefix e2e
npx --prefix e2e playwright install chromium
```

Configure `e2e/.env.e2e` from `e2e/e2e.env.example`. Confirm `DB_NAME=lms_e2e` before using database reset commands.

## Run the complete project test sequence

```powershell
Set-Location backend
npm test
npm run lint
npm run deps:check
Set-Location ..\frontend
npm test
npm run lint
npm run build
npm run deps:check
Set-Location ..\e2e
npm run db:reset
npm test
```

To have Playwright reset and reseed the isolated E2E database before starting its backend:

```powershell
$env:E2E_RESET_DB = '1'
npm test
Remove-Item Env:E2E_RESET_DB
```

Backend does not currently define npm scripts named `db:migrate` or `db:seed`; the E2E package invokes the existing `database/migrate.js` and `database/seed.js` directly.

## E2E smoke, full suite, and debugging

From `e2e/`:

```powershell
npm run test:smoke
npm test
npm run test:ui
npm run test:headed
npm run report
```

Playwright defaults to Chromium, one worker, and a serial test run. On pull requests CI runs smoke; pushes to `main` run all E2E specs. HTML report, trace, and failure screenshots are saved under `.generated/`.

## Ownership

| Spec | Owner | Journey |
|---|---|---|
| `e1-giang-day.spec.js` | A | Course teaching, lessons, schedules, and materials |
| `e2-bai-tap.spec.js` | B | Assignment submission, grading, and gradebooks |
| `e3-trac-nghiem.spec.js` | C | Quiz authoring and student attempts |

The PRD describes these flows in the DoD scenarios (1) through (3); it does not currently contain headings with literal `E2E-1`, `E2E-2`, or `E2E-3` identifiers.
