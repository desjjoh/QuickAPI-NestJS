# QuickAPI-NestJS

A production-minded NestJS backend with layered domain services, account security, article publishing, and durable background work.

This repository is more than a CRUD starter: it includes transaction-aware auditing, optimistic concurrency, database-backed request idempotency, and recovery paths for email and object storage. Automated checks validate these boundaries; production readiness still depends on the deployment environment and operational ownership.

## What's included

- Identity: registration, sign-in, refresh/session management, MFA, password reset, email verification, profiles, and user administration.
- Articles: public reading, creator editing and submission, administrator review/publishing, hero images, and explicit transition rules.
- Shared reference data, permissions, and lean repositories with service-owned mutations.
- MySQL/TypeORM migrations, Redis/BullMQ workers, email outbox, and durable storage deletion/upload tracking.
- OpenAPI documentation, structured logging, health/readiness endpoints, opt-in metrics, and production-image CI checks.

## Getting started

Use Node.js 22, npm, Docker Engine, and Docker Compose v2.

1. Run `npm ci`, then copy [.env.example](.env.example) to a gitignored `.env`.
2. Follow [local configuration](docs/development.md#local-configuration): replace secrets, set development logging, and configure GeoLite data. R2 is the only supported storage provider; all R2 settings are required at startup.
3. Start dependencies and apply migrations:

   ```bash
   npm run docker:mysql:up
   npm run docker:redis:up
   npm run migration:run
   npm run geoip:update
   ```

4. Set `DB_SEED=true` for the first application start to populate required reference data, then run `npm run start:dev`. Disable startup seeding after initialization.

The default local API is `http://localhost:4000`. Swagger at `/docs` is opt-in through `DOCUMENTATION_ENABLED=true`; when enabled it is public unless restricted by your ingress. See [operational access](docs/deployment.md#observability-and-operations).

## Documentation

| Guide                                           | Contents                                                                           |
| ----------------------------------------------- | ---------------------------------------------------------------------------------- |
| [Development](docs/development.md)              | Setup, configuration, migrations, seeding, GeoIP, and local infrastructure         |
| [Architecture](docs/architecture.md)            | Layer boundaries, modules, transactions, and extension rules                       |
| [API contracts](docs/api-contracts.md)          | Audience routes, article pagination/search, concurrency, idempotency, and security |
| [Reliability and recovery](docs/reliability.md) | Durable email/storage, retries, DLQ boundaries, privacy, and recovery procedures   |
| [Testing](test/TESTING.md)                      | Test coverage, disposable databases, PowerShell commands, and CI                   |
| [Deployment and operations](docs/deployment.md) | Staging topology, immutable releases, diagnostics, backups, and rollback           |
| [Technical backlog](docs/backlog.md)            | Verified gaps and intentionally deferred work                                      |

Configuration keys live in [.env.example](.env.example) and [.env.staging.example](.env.staging.example); validation lives in [src/config](src/config). Commands are defined in [package.json](package.json). These are the source of truth rather than a second environment-variable dump in this README.

## API overview

| Audience                         | Route                      |
| -------------------------------- | -------------------------- |
| Public articles                  | `/api/v1/public/articles`  |
| Creator articles                 | `/api/v1/creator/articles` |
| Article and user administration  | `/api/v1/administration`   |
| Authentication and registration  | `/api/v1/authentication`   |
| Current account/profile/sessions | `/api/v1/account`          |
| Account security                 | `/api/v1/security`         |
| Reference data                   | `/api/v1/library`          |

There are no aliases for the old `/api/v1/articles` routes. See [API contracts](docs/api-contracts.md) before integrating retries, lifecycle actions, or versioned updates. Enabled Swagger provides the detailed endpoint schemas.

## Quality checks

```bash
npm run check
npm run test:cov
```

E2E tests reset their explicitly selected disposable database. Read [Testing](test/TESTING.md) before running them. CI also checks migration/readiness and production topology; a green run does not replace real-provider, backup-restore, or deployment validation.

## License

[MIT](LICENSE).
