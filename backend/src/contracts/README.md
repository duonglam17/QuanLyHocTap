# Inter-module service contracts

Modules communicate through public Service interfaces or these Ports. Do not import another module's controller, repository, or model, and do not query another module's tables.

`registry.js` exports `registerPort(name, implementation)` and `getPort(name, { optional })`. Registration names must be unique. A required missing Port throws; an optional missing Port returns `null`. Module `init(ctx)` receives an isolated registry at `ctx.contracts`.

## Ports

The detailed source `docs/contracts.md` referenced in the implementation request is absent from this repository. The method names already present in the codebase and architecture docs have been retained; signatures and data shapes below are explicit provisional assumptions.

- `courseAccess.validateEnrollment(courseId, studentId)` resolves to `{ courseId, studentId, enrolled }`.
- `courseAccess.validateCourseOwner(courseId, instructorId)` resolves to `{ courseId, instructorId, isOwner }`.
- `courseAccess.getLessonSummary(lessonId)` resolves to `{ id, courseId, title, orderIndex }` or `null`.
- `quizResults.getStudentQuizGrades(courseId, studentId)` resolves to an array of `{ quizId, title, score, totalQuestions, correctAnswersCount, status }`.
- `quizResults.getQuizScoresForStudent(courseId, studentId)` resolves to an array of quiz scores; each score may include `visibleToStudent`, and hidden scores are omitted from student gradebooks.
- `notifications.notifyCourseStudents(courseId, notification)` resolves to `{ courseId, notifiedCount }`. The notification object has `type`, `title`, `content`, and optional `metadata`; `SCHEDULE_CHANGED` is a supported event name.

JSDoc signatures are in `ports.js`; reusable test doubles are in `fakes/`. Update both production and fake implementations together when the module owners agree on any contract change.
