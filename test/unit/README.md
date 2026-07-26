# Unit service tests

Import shared builders and typed mocks from `test/unit`. Builders return a small,
valid baseline entity and accept `Partial<Entity>` overrides, so a test only names
the state relevant to its behavior.

Keep every service test focused on one public behavior:

1. **Arrange dependencies** with `mockRepository`, `mockDataSource`, and the
   adapter mocks. Configure only responses needed by the behavior and create state
   with a builder such as `buildActiveUser({ roles: [role] })`.
2. **Act once** by invoking one public service method.
3. **Assert returned state** rather than internal implementation details.
4. **Assert persistence** (`save`, `update`, transaction calls) and external side
   effects (email, queue, Redis, cookies, or storage).
5. **Assert expected exceptions** with `await expect(...).rejects`; also verify that
   persistence and side effects did not run on rejected paths.

Use deterministic time and generated values whenever they affect an assertion:

```ts
import {
  buildActiveUser,
  deterministicGenerators,
  mockEmailService,
  mockRepository,
  resetUnitTestState,
  useDeterministicClock,
} from './index';

describe('ExampleService', () => {
  afterEach(resetUnitTestState);

  it('performs one behavior', async () => {
    // Arrange dependencies and state.
    useDeterministicClock();
    const users = mockRepository<UserEntity>();
    const email = mockEmailService();
    const generated = deterministicGenerators();
    const user = buildActiveUser();
    users.save.mockResolvedValue(user);

    // Act once through the public API.
    const result = await service.perform(user, generated.token());

    // Assert state, persistence, and side effects.
    expect(result).toBe(user);
    expect(users.save).toHaveBeenCalledWith(user);
    expect(email.sendEmail).toHaveBeenCalledTimes(1);
  });
});
```

Every suite must call `afterEach(resetUnitTestState)`. This restores spies, clears
mock call state, and returns Jest to real timers, preventing order-dependent tests.
