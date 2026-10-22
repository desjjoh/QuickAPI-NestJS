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
        articles/   Authenticated article authoring controllers/services
        administration/
        authentication/
        account/
        security/
        public/     Library startup/reference controller and public articles
    domain/         Articles, identity, media, audit, and library
    system/         Storage, cleanup, email, queues, idempotency, context,
                    geolocation, database, and other infrastructure concerns
test/
  unit/             Isolated specs mirroring src, plus shared typed test builders
  integration/      Component/HTTP/filesystem specs mirroring src
  e2e/              Database-backed HTTP E2E suites
  helpers/          Shared test infrastructure and fixtures
```

- **Repositories** are the domain's datasource boundary. Keep queries focused and read-only; do not add application mutations or orchestration here.
- **Domain services** own writes, cross-repository access, and application rules. Resolve or receive the transaction manager consistently, including audit writes.
- **Policies** own business rules such as allowed article status transitions; persistence remains in services.
- **API services/controllers** handle audience authorization, request/response models, and orchestration through domain services.
- **System services** own queue, storage, cleanup, delivery, and reusable request infrastructure. Media imports these capabilities; it does not implement provider or queue mechanics.

The standalone [image processor](image-processing.md) owns raster transforms and
WebP encoding. Feature presets belong to their consumers; persistence, upload
tracking, and cleanup remain outside the processor. New avatar uploads use the
media domain's static 256×256 policy; article uploads remain unprocessed.

Identity capabilities are split into lifecycle, credentials, and administration services, with a shared user service where appropriate. Prefer a coherent capability over another service that duplicates persistence logic.

Identity owns account statuses, genders, roles, and permissions, including their
entities, read repositories, response models, and seeders. The library domain owns
shared country, region, and time-zone reference data and does not depend on
identity. The public API module's library controller composes both domains at
`/api/v1/public/library`; lookup response contracts remain independent of domain
ownership.

## Transactions and external effects

Application context allows opted-in services to join the request transaction. Reuse the caller's manager rather than starting unrelated transactions or using the root datasource for request-owned writes. Some services require an explicit manager: do not assume every provider joins context automatically.

Success audit events must commit with the mutation. Idempotency records must commit with the protected operation. Security-operation handling stages cookies until commit; OTP failure accounting deliberately persists outside the rolled-back request transaction.

Remote storage/email cannot participate in MySQL rollback. Durable SQL intents and independently committed upload reservations bridge that boundary. Queue delivery is at least once, and worker reference checks protect current data. See [reliability contracts](reliability.md) before changing these paths.

## Article reads and writes

Creator is a supplemental role. Site administrators currently own publication permissions; there is no separate publisher role. Permission checks and ownership/visibility remain separate concerns.

Shared article query/outbound models belong to the articles domain, including minimal author display data and list representations. List queries count/page the lean article scope before loading display relations. Details use their own representation rather than widening every listing.

Article lifecycle transitions go through the dedicated policy. Optimistic versions protect stale requests, while row locks serialize active lifecycle transactions. Neither request IDs nor idempotency keys replace expected versions.

## Adding a capability

1. Define the audience's permissions and outbound contract.
2. Add focused repository reads and service-owned mutations.
3. Keep transaction, audit, storage, and delivery effects consistent.
4. Explicitly decide version and replay behavior.
5. Add allow/deny, rollback, retry, and concurrency tests.
6. Update the relevant focused guide, not a duplicate overview in the README.
