# Inter-module contracts

[`docs/contracts.md`](../../../docs/contracts.md) is the source of truth for the shared Ports, common interfaces, module loader, and their method signatures.

`index.js` exposes `registerPort(name, impl)` and `getPort(name, { optional })`. Each app loader provides its registry through `init(ctx)` as `ctx.contracts`; modules register provider Ports there during initialization and resolve required or optional Ports while handling a request.

## Ports

`docs/contracts.md` is the source of truth for Port names, signatures, and data shapes. JSDoc signatures are in `ports.js`; reusable test doubles are in `fakes/`.

- `assessmentUsage` is provided by M2; `quizUsage` is provided by M3. Each exposes `hasCourseData(courseId)` and `hasUserData(userId)`, both returning `Promise<boolean>`.
- M1 resolves these optional Ports at request time. A missing provider is treated as existing data, so M1 falls back to archiving or soft deletion and never hard-deletes.
- The usage fake factories return `false` by default and accept `{ courseHasData: true, userHasData: true }` for positive cases.
