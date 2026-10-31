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

API orchestration that previously opened its own transaction now uses `requireApplicationTransaction()` to obtain the active manager and lifecycle, failing before writes when no live boundary exists. Mutations and audits use that manager, including profile reference validation. Domain methods join the active context and retain explicit transaction entry points for workers, commands, and other non-HTTP callers. Ordinary reads are not automatically transactional; existing security-controller policies, including session reads, retain their existing behavior.

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

## Adding a capability

1. Define the audience's permissions and outbound contract.
2. Add focused repository reads and service-owned mutations, declaring the HTTP transaction policy on each mutation route.
3. Keep transaction, audit, storage, and delivery effects consistent.
4. Explicitly decide version and replay behavior.
5. Add allow/deny, rollback, retry, and concurrency tests.
6. Update the relevant focused guide, not a duplicate overview in the README.
