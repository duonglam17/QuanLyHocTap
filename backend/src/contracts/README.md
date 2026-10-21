# Inter-module contracts

[`docs/contracts.md`](../../../docs/contracts.md) is the source of truth for the shared Ports, common interfaces, module loader, and their method signatures.

`index.js` exposes `registerPort(name, impl)` and `getPort(name, { optional })`. Each app loader provides its registry through `init(ctx)` as `ctx.contracts`; modules register provider Ports there during initialization and resolve required or optional Ports while handling a request.

The JSDoc signatures are in `ports.js`. Matching test fakes for `courseAccess`, `quizResults`, and `notifications` are in `fakes/`. Keep these signatures and fake result shapes aligned with the source contract.
