# QuickAPI-NestJS

A production-minded NestJS backend with layered domain services, account security and durable background work.

This repository is more than a CRUD starter: it includes transaction-aware auditing, optimistic concurrency, database-backed request idempotency, and recovery paths for email and object storage. Automated checks validate these boundaries; production readiness still depends on the deployment environment and operational ownership.

## What's included

- Identity: registration, sign-in, refresh/session management, MFA, password reset, email verification, profiles, and user administration.
- Shared reference data, permissions, and lean repositories with service-owned mutation workflows.
- MySQL/TypeORM migrations, Redis/BullMQ workers, email outbox, and durable storage deletion/upload tracking.
- OpenAPI documentation, structured logging, health/readiness endpoints, opt-in metrics, and production-image CI checks.

## Getting started

Use Node.js 22, npm, Docker Engine, and Docker Compose v2.

Follow [Setup](docs/setup.md) to install dependencies, configure `.env`, start
MySQL/Redis, apply migrations, seed reference data, and initialize GeoIP before
starting the API. The required provider settings and local/test environment
boundaries are documented in [Configuration](docs/configuration.md).

The default local API is `http://localhost:4000`. Swagger at `/docs` is opt-in through `DOCUMENTATION_ENABLED=true`; when enabled it is public unless restricted by your ingress. See [operational access](docs/deployment.md#observability-and-operations).

## Documentation

| Guide                                  | Contents                                                                            |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| [Setup](docs/setup.md)                 | Installation, local infrastructure, migrations, seeding, and development commands   |
| [Architecture](docs/architecture.md)   | Layer boundaries, transaction ownership, audit invariants, and extension rules      |
| [Configuration](docs/configuration.md) | Environment sources, validation, providers, and local/test/staging targets          |
| [Testing](docs/testing.md)             | Test layers, coverage, disposable databases, and CI checks                          |
| [Security](docs/security.md)           | Identity, permissions, cookies, proxy trust, operational access, and security gates |
| [Deployment](docs/deployment.md)       | Staging topology, immutable releases, backups, and rollback                         |
| [Backlog](docs/backlog.md)             | Known limitations and deferred work                                                 |

Specialist guides: [API contracts](docs/api-contracts.md),
[image processing](docs/image-processing.md), and
[reliability and recovery](docs/reliability.md).

Configuration keys live in [.env.example](.env.example) and [.env.staging.example](.env.staging.example); validation lives in [src/config](src/config). Commands are defined in [package.json](package.json). These are the source of truth rather than a second environment-variable dump in this README.

## API overview

| Audience                         | Route                    |
| -------------------------------- | ------------------------ |
| Administration                   | `/api/v1/administration` |
| Authentication and registration  | `/api/v1/authentication` |
| Current account/profile/sessions | `/api/v1/account`        |
| Account security                 | `/api/v1/security`       |
| Public startup/reference data    | `/api/v1/public/library` |

## Quality checks

```bash
npm run check
npm run test:cov
```

See [Testing](docs/testing.md) for E2E/database safety and production-image checks,
and [Security](docs/security.md#dependency-and-image-security) for audit policies.
Automated checks do not replace real-provider, backup-restore, or deployment validation.

## License

[MIT](LICENSE).
