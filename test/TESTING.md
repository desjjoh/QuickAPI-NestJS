# Testing and coverage

[Documentation index](../README.md#documentation)

## Fast checks

```bash
npm test
npm run test:unit
npm run test:integration
npm run test:cov
npm run check
```

`npm run test:release` runs dependency-free Node tests of release gating, exception scopes/expiry, scanner failures, evidence tampering, and publication ordering. It does not build, scan, authenticate to a registry, or publish. CI runs these tests before release eligibility. `npm run release:check` separately builds and scans a real local production candidate, retaining OCI provenance/SBOM and complete findings under ignored `.release-check/`; it never pushes an image. Critical findings require remediation or explicit reviewed exceptions, even without a fix. HIGH/lower findings remain visible.

The optional `RELEASE_REGISTRY_TEST=true` transport regression requires `RELEASE_TEST_ARCHIVE` and `RELEASE_TEST_EVIDENCE` pointing to an approved local candidate. It copies that candidate only into a newly created private Docker registry/network with no host ports, verifies digest/attestation preservation, then removes those test containers/network. It never uses production credentials or contacts GitHub. Registry permission behavior still needs environment-specific verification.

`npm test` includes all suites beneath `test/unit` and `test/integration`. Both directories mirror the paths beneath `src` (for example, `src/modules/domain/articles/services/article.service.ts` is tested by `test/unit/modules/domain/articles/services/article.service.spec.ts`). Unit tests isolate behavior with mocked dependencies. Integration tests exercise real component boundaries such as the Nest HTTP pipeline, TypeORM SQL/metadata, and filesystem/image processing; they do not require live providers or the E2E database. Classify by behavior, not by filename. E2E suites remain in `test/e2e`, and shared support stays in `test/helpers` and `test/unit`.

CI selects the two categories by directory, not an `integration.spec.ts` suffix. Coverage targets production files beneath `src`, not test files. `npm run check` also checks formatting, lint, types, and build, but does not start Docker or run E2E. Shared unit-test conventions are in [test/unit](unit/README.md).

Test setup explicitly selects the supported R2 driver and supplies inert R2 credentials/URLs before configuration loads, independent of a developer's `.env`. Storage tests mock the SDK or replace `StorageService` with an in-memory provider; they do not enable a nonexistent local driver or use live bucket credentials.

## Dependency security in base CI

`npm run test:security` exercises the dependency-audit gate without network access,
including high/critical blocking, exact exception matching, UTC expiry, the 30-day
exception limit, malformed evidence, command failures, and separate development
reporting. `npm run check` includes these tests.

`npm run security:audit` performs real production and full-tree npm audits. CI's
`Dependency security` job blocks both `Check` and `Staging deployment gate` on
unexcepted production high/critical findings or invalid/unavailable evidence.
Development-only findings are reported separately and do not block by severity.
Reports and the empty-by-default register are retained even on failure; see the
[dependency audit policy](../security/dependency-audit-exceptions.md). The existing
release-image scan remains separate and retains its critical-only blocking policy.
Neither audit command installs updates or applies fixes automatically.

## Disposable E2E infrastructure

E2E global setup **drops, migrates, and seeds the selected schema**. Never point these tests at development, staging, or production data. Safety requires explicit `TEST_DB_ENABLED=true`, `NODE_ENV=test`, `DB_SYNC=false`, and an active database exactly matching `TEST_DB_DATABASE`; a name containing “test” is not sufficient protection.

`test/load-test-env.ts` sets the test runtime and copies explicit test connection values before configuration loads. The checked-in [test Compose topology](../docker-compose.test.yml) uses MySQL port 3308 and authenticated Redis port 6380, separate from development services.

### POSIX shells

```bash
npm run test:infra:up
npm run test:e2e:local
```

Global setup applies all migrations, so a separate `test:db:prepare` is not required. That command is available for manual inspection of a disposable database.

### PowerShell

The convenience `test:e2e:local` and `test:db:prepare` scripts use POSIX environment assignment. In a dedicated PowerShell session instead run:

```powershell
npm run test:infra:up
$env:TEST_DB_ENABLED = 'true'
$env:TEST_DB_HOST = '127.0.0.1'
$env:TEST_DB_PORT = '3308'
$env:TEST_DB_USER = 'quickapi_test_app'
$env:TEST_DB_PASSWORD = 'quickapi_test_password'
$env:TEST_DB_DATABASE = 'quickapi_test'
$env:REDIS_HOST = '127.0.0.1'
$env:REDIS_PORT = '6380'
$env:REDIS_PASSWORD = 'quickapi_test_redis_password'
npm run test:e2e
```

These credentials are for the disposable checked-in topology only. Close the dedicated shell afterwards to avoid carrying test overrides into development.

Run one E2E invocation at a time per database/Redis topology; another invocation's global setup can destroy the first one's fixtures. CI shards use separate infrastructure.

For a focused run after setting the same environment:

```bash
npm run test:e2e -- --runInBand --runTestsByPath test/e2e/articles/articles.e2e-spec.ts
```

For teardown diagnostics, append `--detectOpenHandles`. Do not use `--forceExit` to hide leaked connections/workers.

`npm run test:infra:down` **deletes disposable containers and volumes**. It is not a shutdown command for a database you want to preserve.

## Regression map

These are existing suites, not placeholders or a claim that every possible failure has been tested.

| Boundary                                                                                  | Suites                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database-backed claims, rollback, 204 replay, expiry/concurrency                          | [idempotency](e2e/idempotency/idempotency.e2e-spec.ts)                                                                                                                                                                    |
| Admin authorization, revisions, deletion, replay, audit                                   | [users](e2e/administration/users.e2e-spec.ts)                                                                                                                                                                             |
| Profile/contact/avatar replay, recreated contacts, upload validation                      | [profile](e2e/account/profile.e2e-spec.ts)                                                                                                                                                                                |
| Article permissions, versions, lifecycle, heroes, pagination/search/EXPLAIN               | [articles](e2e/articles/articles.e2e-spec.ts)                                                                                                                                                                             |
| Registration and verification                                                             | [registration](e2e/authentication/registration.e2e-spec.ts), [verification](e2e/authentication/email-verification.e2e-spec.ts)                                                                                            |
| MFA, reset, credentials, sessions                                                         | [MFA](e2e/authentication/mfa.e2e-spec.ts), [reset](e2e/authentication/password-reset.e2e-spec.ts), [credentials](e2e/authentication/account-credentials.e2e-spec.ts), [sessions](e2e/authentication/sessions.e2e-spec.ts) |
| Encrypted email intents, cancellation/expiry/retry, real Redis worker with fake transport | [security delivery](e2e/authentication/security-delivery.e2e-spec.ts)                                                                                                                                                     |
| Storage intents, upload reconciliation, reference fencing, retries/DLQ                    | [storage cleanup](e2e/storage/storage-cleanup.e2e-spec.ts)                                                                                                                                                                |
| User repository against MySQL                                                             | [user repository](e2e/repositries/user.repository.e2e-spec.ts)                                                                                                                                                            |
| Account activity visibility                                                               | [activity](e2e/account/activity.e2e-spec.ts)                                                                                                                                                                              |
| Dependency readiness                                                                      | [readiness](e2e/ready.e2e-spec.ts)                                                                                                                                                                                        |

HTTP test apps replace background dispatchers and pause their own workers to isolate request assertions. Dedicated delivery/cleanup tests create uniquely named queues/workers and exercise real Redis with fake external providers. Passing HTTP tests alone does not prove automatic production worker delivery or real-provider availability.

Use event/subject-filtered audit assertions or a captured baseline; authentication fixture setup can legitimately add events. Do not log EXPLAIN plans, raw email payloads, tokens, or other sensitive data in passing tests.

## Coverage gates

Jest instruments services, processors, guards, and repositories, including unimported files. DTOs, migrations, bootstrap, tests, and generated artifacts are excluded from that instrumentation; schema behavior is checked through migration/topology tests instead.

Current thresholds are defined in [package.json](../package.json):

- Global: branches 40%, functions 45%, lines/statements 65%.
- Identity services: branch coverage 75%.
- Permission guard: branch coverage 90%.
- Authentication and account API services: branch coverage 75%.

Thresholds are a baseline, not security sign-off. Require tests for security-sensitive allow/deny, expiry, replay, revocation, lockout, rollback, and error mapping. Review the HTML report in `coverage/lcov-report`; do not lower gates to hide a known missing security branch.

## CI and production-image checks

[CI](../.github/workflows/ci.yml) runs for pushes and pull requests to `main`, `staging`, and `dev`, plus manual dispatch. It separates formatting, lint, type checking/build, unit coverage, integration, two E2E shards, production-image migration/readiness, and production topology smoke checks; aggregate gates depend on those results.

```bash
npm run test:smoke
```

This command requires Docker/Compose and Bash, plus outbound HTTPS for public MaxMind test databases. It builds the production image and runs an immutable-image disposable topology with authenticated MySQL/Redis, staging preflight, fresh GeoLite initialization, compiled migrations, the non-root API, HTTP policy/readiness probes, compiled migration revert/forward, and graceful shutdown.

The smoke test also rejects runtime package managers and exercises real Sharp
WebP encoding and bcrypt hashing inside the production container. Operational
commands execute compiled entry points directly with Node, without npm. These
checks protect the minimal-runtime/native-library boundary, not just TypeScript
behavior on the host.

It removes its disposable containers/network/volumes on completion or failure and writes failure diagnostics to `smoke-logs/`. Run `test:smoke:config` in a POSIX shell to check Compose rendering only. Neither command is a real-provider test or a production deployment.

Release review should use evidence from the exact release commit, including failures that prevent suites from reaching their tests. Do not embed transient suite counts or “tests not run here” notes in product documentation. See [deployment](../docs/deployment.md) and [remaining gaps](../docs/backlog.md).
