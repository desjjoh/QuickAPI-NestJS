# Architecture

[Documentation index](../README.md#documentation)

## Layer boundaries

```text
src/
  common/           Shared decorators, guards, models, and repository helpers
  config/           Validated environment and deployment configuration
  database/         TypeORM datasource and migrations
  modules/
    api/            HTTP controllers and audience-specific orchestration
      v1/
        administration/
        authentication/
        account/
        security/
        public/     Library startup/reference controller
    domain/         Identity, media, audit, and library
    system/         Storage, cleanup, email, queues, idempotency, context,
                    geolocation, database, and other infrastructure concerns
test/
  unit/             Isolated specs mirroring src, plus shared typed test builders
  integration/      Component/HTTP/filesystem specs mirroring src
  e2e/              Database-backed HTTP E2E suites
  helpers/          Shared test infrastructure and fixtures
```

- **Repositories** are the domain's datasource boundary. Execute focused, reusable reads and writes with the supplied manager. Keep application decisions and orchestration in domain services.
- **Domain services** own mutation decisions, cross-repository orchestration, and application rules. Repositories execute reusable database reads and writes using the supplied manager. Resolve or receive the transaction manager consistently, including audit writes.
- **Policies** own business rules such as account deletion eligibility; persistence remains in repositories.
- **API services/controllers** handle audience authorization, request/response models, and orchestration through domain services. They pass transaction managers to domain services; they never query an EntityManager or import repositories. Domain services pass managers to repository reads, including locked reads and explicit tombstone reloads for audit snapshots.
- **System services** own queue, storage, cleanup, delivery, and reusable request infrastructure. Media imports these capabilities; it does not implement provider or queue mechanics.

The standalone [image processor](image-processing.md) owns raster transforms and
WebP encoding. Feature presets belong to their consumers; persistence, upload
tracking, and cleanup remain outside the processor. New avatar uploads use the
media domain's static 256×256 policy.

Identity capabilities are split into lifecycle, credentials, and administration services, with a shared user service where appropriate. Prefer a coherent capability over another service that duplicates persistence logic.

Identity owns account statuses, genders, roles, and permissions, including their
entities, repositories, response models, and seeders. The library domain owns
shared country, region, and time-zone reference data and does not depend on
identity. The public API module's library controller composes both domains at
`/api/v1/public/library`; lookup response contracts remain independent of domain
ownership.

## Transactions and external effects

Application context allows opted-in services to join the request transaction. Reuse the caller's manager rather than starting unrelated transactions or using the root datasource for request-owned writes. Some services require an explicit manager: do not assume every provider joins context automatically.

Success audit events must commit with the mutation. Idempotency records must commit with the protected operation. Security-operation handling stages cookies until commit; OTP failure accounting deliberately persists outside the rolled-back request transaction.

HTTP mutation boundaries belong to route policies: `@Transactional()` for ordinary mutations, `@Idempotent(...)` for transactional mutations with optional replay, and `@SecurityOperation()` for credential/challenge/cookie flows. `TransactionsModule` supplies the shared request transaction entry point. Keyed requests use the idempotency engine's locked transaction; unkeyed requests use the same shared lifecycle without a replay claim. Combining `@Transactional()` with a specialized policy delegates to that policy regardless of decorator order, rather than opening competing transactions.

API orchestration uses `requireApplicationTransaction()` to obtain the active manager and lifecycle, failing before writes when no live boundary exists. Mutations and audits use that manager, including profile reference validation. Domain methods join the active context and retain explicit transaction entry points for workers, commands, and other non-HTTP callers. Ordinary reads are not automatically transactional; existing security-controller policies, including session reads, retain their existing behavior.

Route mutation policy coverage is checked against the mounted v1 route tree, including class-level security policies. The inventory also prevents mixing credential security with response replay and checks consistent profile-update permissions.

| Route family                                                | Transaction and replay policy                                                                                    |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Profile details, country, timezone, avatar, phone, address  | User-scoped `@Idempotent`; one transaction with or without a key                                                 |
| Administrator user update/deletion                          | User-scoped `@Idempotent`, retaining expected-version checks                                                     |
| Sign-in, refresh, sign-out, registration, password reset    | `@SecurityOperation`; no credential/challenge replay                                                             |
| Account credentials, MFA, self-deletion, session revocation | `@SecurityOperation`; these flows may issue/clear cookies, consume challenges, or revoke the caller's own access |
| Library, audit, and ordinary account reads                  | No automatic write transaction; existing security-controller session reads retain their declared policy          |

Identity writes, audits, email intents, and cross-repository reference checks use the request manager. Media and audit query services also resolve default reads through the application context, so they can see the transaction's uncommitted state without acquiring an unrelated connection. Failed OTP/registration-attempt accounting runs independently after the request transaction releases its connection. Upload reservations and active-PUT ownership use their deliberate independent pool/transactions for crash reconciliation. Those exceptions must not be folded into the request rollback boundary.

Remote storage/email cannot participate in MySQL rollback. Durable SQL intents and independently committed upload reservations bridge that boundary. Queue delivery is at least once, and worker reference checks protect current data. See [reliability contracts](reliability.md) before changing these paths.

## HTTP transaction implementation

Mutation routes explicitly declare `@Transactional()`, `@Idempotent(...)`, or `@SecurityOperation()`. The latter two include transaction ownership; a plain `@Transactional()` may be combined with them without creating another root transaction. Import `TransactionsModule` in modules declaring these policies. Guards continue to authorize requests before interceptors; parameter validation and handler work execute inside the declared boundary after any outer multipart parsing.

The response is produced after commit and lifecycle completion. Mutation, audit, and keyed replay state commit together. Errors roll back participating database writes; cleanup actions run only after database work has settled and its connection is released. A deadline or disconnect does not forcibly release an in-use transaction. Security responses keep cookie staging until commit, reject replay keys, and preserve independent failed-attempt accounting. Routes returning streaming/manual responses are outside this buffered single-response transaction contract.

API mutation services fail closed when their required route transaction is missing; do not call them directly from workers or scripts without an explicit application transaction. Domain services remain the non-HTTP mutation entry points.

## Persistence and audit invariants

Audit classifications (`actor_type`, `source`, `domain`, `subject_type`, and `resource_type`) are database enums matching the controlled application catalogs. Subject/resource types remain nullable. Event names and historical identifiers remain strings; emitted events must still use a valid namespaced name matching their domain. Adding a classification requires both an application catalog change and a migration; retain enum values needed by historical records even when they are no longer emitted. MySQL strict SQL mode is required for invalid enum values to fail rather than coerce to an empty enum value.

The baseline creates the controlled classifications as database enums. Future catalog changes require a reviewed forward migration that preserves values needed by retained historical records. Migration catalogs are frozen independently of evolving application constants.

Self-service and administrator deletion capture the fresh row under a write lock, reload the persisted tombstone, and insert the audit in the same transaction as deletion and avatar cleanup intent. These deletion events retain complete policy-redacted before/after context plus a separate diff, including stable user/profile IDs, names, administration revision, status, deletion timestamp, and avatar ID/removal. Audit failure rolls back the mutation; completed administrator idempotency retries replay without another audit event.

Security routes use the shared request transaction and root-user lock. Authentication, account-security, registration, and session audits reload the relevant state at the mutation boundary rather than diffing stale guard objects or intended outcomes. Registration snapshots are taken after session issuance/sign-in metadata; revoked sessions are reloaded including their inactive state. Invalid OTP-attempt accounting keeps its existing independent persistence behavior. Historical audit rows are not backfilled; names and stable subject IDs remain available after deletion, but original emails cannot be recovered from these redacted audit records.

## Idempotency implementation

The reusable `Idempotent` decorator/interceptor and system idempotency service own this concern; controllers only opt in. When adding another operation, import `IdempotencyModule` and `TransactionsModule` and apply the decorator above any multipart interceptor. The route policy owns the transaction for both keyed and unkeyed requests. API orchestration consumes `requireApplicationTransaction()` and explicitly passes its manager/lifecycle to downstream writes and audit calls; it does not open a separate transaction. Domain operations using `runInTransaction` join that active boundary. Identity and audit services resolve their default managers through `applicationManager`, so they also join the active application transaction; other services must explicitly opt in or receive the manager. Nontransactional external effects still need lifecycle compensation or an outbox; this is not a general guarantee of exactly-once delivery to external systems. This decorator is not suitable unchanged for anonymous authentication or token/cookie-issuing flows.

The idempotency scope owner is nullable for public replay. Apply all pending migrations before running code that can execute public-scoped operations; existing user-scoped hashes remain compatible. Downgrade is rejected while public replay records exist: let their retention expire and purge them before reverting rather than deleting live duplicate-execution fences.

## Adding a capability

1. Define the audience's permissions and outbound contract.
2. Add reusable repository reads/writes and service-owned mutation workflows, declaring the HTTP transaction policy on each mutation route.
3. Keep transaction, audit, storage, and delivery effects consistent.
4. Explicitly decide version and replay behavior.
5. Add allow/deny, rollback, retry, and concurrency tests.
6. Update the relevant focused guide, not a duplicate overview in the README.

## Documentation ownership

Keep the [README](../README.md) as the quick entry point. Maintain one authoritative
location per topic:

- [Setup](setup.md): installation, local startup, migrations, and seeding commands.
- [Configuration](configuration.md): environment sources, validation, and topology.
- [API contracts](api-contracts.md): client-visible behavior and compatibility.
- [Testing](testing.md): commands, isolation, coverage, and verification boundaries.
- [Security](security.md): identity, access, sensitive data, and security-policy links.
- [Deployment](deployment.md): release and operator procedures.
- [Backlog](backlog.md): unresolved work and environment-owned evidence.

Architecture and specialist guides explain implementation invariants. Link to
those guides instead of repeating their contracts. Write current behavior in the
present tense; preserve dated execution evidence with the relevant release rather
than adding implementation diaries or transient pass counts to reference guides.
When moving a guide or changing a heading, update inbound links and check local
file targets and anchors. Keep examples consistent with scripts and validation.
