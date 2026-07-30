# Testing and coverage policy

## Coverage scope and gates

`npm run test:cov` instruments application services, queue processors, guards,
and repositories, including files that a test never imports. DTO-only
declarations, migrations, bootstrap code, test files, and generated artifacts
are intentionally excluded because their executable behavior is either absent
or validated at a different boundary.

The global threshold is an achievable baseline, not a security sign-off. Jest
also enforces higher branch thresholds on identity tokens and refresh, MFA and
password reset, email verification and registration, permission guards, and the
authentication/account orchestration layers. Raise the relevant threshold in
the same change that adds branch coverage; do not pre-raise it in a way that
leaves the default branch failing.

**Release rule:** every security-sensitive allow, deny, expiry, replay,
revocation, lockout, and error-mapping branch must have a test. A known missing
security branch is a release blocker even when Jest's aggregate and scoped
thresholds pass. Review the detailed HTML report in `coverage/lcov-report` and
record any intentional exception in the release review; reducing or bypassing
a threshold is not an acceptable exception.

## Test matrix

Legend: **Unit** is an isolated `*.spec.ts`; **Integration** exercises multiple
Nest providers or an infrastructure adapter; **E2E** exercises the HTTP API and
disposable MySQL/Redis stack. “Required” identifies the intended layer even if
the corresponding scenario still needs to be added; such gaps in a
security-sensitive branch block release.

| Major service or flow                                     | Unit coverage                                              | Integration coverage                               | E2E coverage                                                               |
| --------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------- |
| Domain token issuance, validation, expiry, and revocation | `token.service.spec.ts`                                    | Required with token storage/crypto adapters        | Login, refresh, and logout token lifecycle required                        |
| Refresh-token rotation and replay rejection               | `refresh.service.spec.ts`                                  | Required with persisted session/token state        | Refresh success, expired/revoked token, and replay rejection required      |
| Registration-token issue and consumption                  | `registration-token.service.spec.ts`                       | Required with token and user providers             | Registration completion and reused/expired token rejection required        |
| MFA enrollment, challenge, recovery, and removal          | `mfa.service.spec.ts`                                      | Required with user/token persistence               | Enrollment and valid/invalid/replayed challenge required                   |
| Password reset request and completion                     | `password-reset.service.spec.ts`                           | Required with email, token, and user providers     | Request, expiry, one-time use, and session invalidation required           |
| Email verification issue and completion                   | `email-verification.service.spec.ts`                       | Required with email, token, and user providers     | Verification, expiry, and replay rejection required                        |
| Registration orchestration                                | `registration.service.spec.ts`                             | Required across user, token, and email providers   | New account, duplicate identity, validation failure, and rollback required |
| Authentication orchestration                              | `authentication.service.spec.ts`                           | Required across credentials, sessions, and tokens  | Login success/failure, lockout, refresh, and logout required               |
| Account profile and current-user orchestration            | `me.service.spec.ts`, `profile.service.spec.ts`            | Required with user repository                      | Authenticated read/update plus unauthorized and invalid update required    |
| Account session orchestration                             | `sessions.service.spec.ts`                                 | Required with session/token state                  | Session listing and self/other-session revocation required                 |
| Security/account recovery orchestration                   | `security.service.spec.ts`                                 | Required across MFA/password/email providers       | Password, MFA, and recovery flows required                                 |
| Permission and authentication guards                      | `permission.guard.spec.ts` plus guard unit specs           | `guards.integration.spec.ts`                       | Missing, malformed, insufficient, and sufficient authorization required    |
| CSRF and operations-route guards                          | `csrf.guard.spec.ts`, `operations.guard.spec.ts`           | `guards.integration.spec.ts`                       | Trusted/untrusted origin and operations-key paths required                 |
| User repository and identity persistence                  | Required                                                   | Repository tests against disposable MySQL required | Exercised by registration/account/auth flows                               |
| Library and media repositories                            | `library.repositories.spec.ts`, `image.repository.spec.ts` | Disposable-MySQL adapter scenarios required        | Exercised by library/media API flows                                       |
| Email queue processors and dead-letter handling           | `email.processor.spec.ts`, `dlq.processor.spec.ts`         | BullMQ/Redis delivery, retry, and DLQ required     | User flows verify enqueueing; worker delivery smoke test required          |
| Email service and transport                               | Required                                                   | Provider sandbox/fake transport required           | Registration/reset/verification delivery contract required                 |
| Storage, geolocation, database, and application services  | Existing service unit specs                                | Adapter startup/failure scenarios required         | Health/readiness and affected API flows required                           |

## Commands

- `npm test` runs the unit and in-process integration suites.
- `npm run test:cov` applies all global and scoped coverage gates.
- `npm run test:infra:up && npm run test:db:prepare && npm run test:e2e:local`
  runs E2E tests against disposable MySQL and Redis dependencies.
- `npm run test:infra:down` removes the disposable dependencies and volumes.

## Production topology smoke test

Run the same production-image test used by the staging gate with one command:

```bash
npm run test:smoke
```

The command requires Docker Engine, Docker Compose v2, and outbound HTTPS access
to GitHub's raw-content host for MaxMind's public test databases. It builds the
production Dockerfile once, addresses that build by immutable image ID, and then
runs the following disposable topology in order:

1. healthy MySQL 8.4 and password-authenticated Redis 7;
2. staging configuration preflight;
3. initialization of a newly-created GeoLite volume with valid public test data;
4. production TypeORM migrations;
5. the API under the image's configured non-root user;
6. HTTP policy probes and graceful SIGTERM shutdown.

The command removes all smoke containers, its private network, and its volumes
on success or failure. If it fails, it first writes component logs to
`smoke-logs/`. To validate only the rendered Compose model without building or
starting containers, run:

```bash
npm run test:smoke:config
```

In GitHub Actions the `Production topology smoke test` job runs the full command
for every staging push and staging pull request. Its log artifact is uploaded on
failure, and the staging deployment gate cannot pass unless the smoke job does.
