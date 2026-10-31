# Unit tests

[Testing guide](../../docs/testing.md) · [Architecture](../../docs/architecture.md)

Import shared builders and typed mocks from `test/unit`. Builders return a small,
valid baseline entity and accept `Partial<Entity>` overrides, so a test only names
the state relevant to its behavior.

Unit specs mirror production paths beneath `src`: a service in
`src/modules/domain/identity/services` has its isolated tests in
`test/unit/modules/domain/identity/services`. Import production code through `@/`.
Tests exercising real HTTP pipelines, SQL/metadata compilation, or filesystem
integration belong in the matching path under `test/integration` instead.

Keep every service test focused on one public behavior:

1. **Arrange dependencies** with `mockRepository`, `mockDataSource`, and the
   adapter mocks. Configure only responses needed by the behavior and create state
   with a builder such as `buildActiveUser({ roles: [role] })`.
2. **Act once** by invoking one public service method.
3. **Assert returned state** rather than internal implementation details.
4. **Assert service-owned persistence** (manager `save`/`update`, transaction calls) and external side
   effects (email, queue, Redis, cookies, or storage).
5. **Assert expected exceptions** with `await expect(...).rejects`; also verify that
   persistence and side effects did not run on rejected paths.

Use deterministic time and generated values whenever they affect an assertion:

```ts
import {
  buildActiveUser,
  deterministicGenerators,
  mockEmailService,
  mockEntityManager,
  resetUnitTestState,
  useDeterministicClock,
} from './index';

describe('ExampleService', () => {
  afterEach(resetUnitTestState);

  it('performs one behavior', async () => {
    // Arrange dependencies and state.
    useDeterministicClock();
    const manager = mockEntityManager();
    const email = mockEmailService();
    const generated = deterministicGenerators();
    const user = buildActiveUser();
    manager.save.mockResolvedValue(user);

    // Act once through the public API.
    const result = await service.perform(user, generated.token());

    // Assert state, persistence, and side effects.
    expect(result).toBe(user);
    expect(manager.save).toHaveBeenCalledWith(user);
    expect(email.sendEmail).toHaveBeenCalledTimes(1);
  });
});
```

The example illustrates assertion shape; construct the actual service with its
dependencies before invoking it. Domain repositories remain read-only: use
repository mocks for reads and the transaction manager for service-owned writes.
Adapter-level TypeORM repository mocks do not authorize mutation methods on a
domain repository.

Use `afterEach(resetUnitTestState)` or equivalent teardown. This restores spies,
clears mock call state, and returns Jest to real timers, preventing order-dependent
tests. When behavior depends on affected rows, relations, or lock results, configure
those mock results explicitly rather than treating an undefined result as success.
