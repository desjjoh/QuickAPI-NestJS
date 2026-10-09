# QuickAPI-NestJS

An opinionated NestJS application foundation developed for my own projects and published openly as reference material. It includes production-minded patterns and working implementations, but every deployment still requires project-specific configuration, review, and operational validation.

---

## Features

- **NestJS 11 + TypeScript-first architecture** with decorators, modules, dependency injection, and path aliases
- **Layered module structure** split into System, Domain, and API boundaries
- **Versioned REST API** under `/api/v1` with public, creator, and administration audience areas alongside security, authentication, account, and library modules
- **TypeORM (MySQL)** as the primary database layer with auto-loaded entities
- **Zod-backed environment validation** with strict SemVer enforcement for `APP_VERSION`
- **Class Validator / Class Transformer** request DTO validation through a global validation pipe
- **OpenAPI (Swagger)** documentation generated from NestJS decorators
- **JWT authentication** with access tokens, refresh-token strategy support, and Passport guards
- **CSRF token issuance and guard support** for browser-based clients
- **Permission-based authorization** through permission decorators, guards, and a central permission matrix
- **Pino logging** with a Nest logger adapter and request logging middleware
- **Prometheus metrics** with default Node.js metrics and HTTP request instrumentation
- **Centralized error handling** through global exception and not-found filters
- **Security middleware** for CORS, rate limiting, content type checks, body limits, header limits, header sanitization, allowed HTTP methods, and security headers
- **Health, readiness, info, system, and metrics endpoints** for deployment and operations
- **Library/reference-data seeders** for countries, country regions, time zones, genders, account statuses, permissions, and roles
- **Email module** powered by Postmark with typed template support
- **Async email queueing** using BullMQ + Redis with DLQ handling and Bull Board UI
- **Profile image upload support** with validation, disk storage, and image metadata handling
- **Graceful lifecycle orchestration** through a shared lifecycle handler
- **Docker Compose local infrastructure** with MySQL, Redis, and API services
- **GitHub Actions CI** for quality checks, migrations, and E2E readiness verification

---

## Folder Structure

```bash
src/
├── common/                     # Shared framework primitives used across the application
│   ├── constants/              # Time and byte constants
│   ├── decorators/             # Auth, permission, upload, and parameter decorators
│   ├── entities/               # Shared entity base classes and value objects
│   ├── errors/                 # Non-HTTP operational/config errors
│   ├── exceptions/             # HTTP/application exception models
│   ├── filters/                # Global and not-found exception filters
│   ├── guards/                 # CSRF, JWT, refresh, local, and permission guards
│   ├── handlers/               # Lifecycle and file handlers
│   ├── helpers/                # Small utilities shared across modules
│   ├── interceptors/           # Global request timeout interceptor
│   ├── loggers/                # Nest-compatible logger implementation
│   ├── middleware/             # Logging, security, metrics, CORS, limits, and context middleware
│   ├── models/                 # Shared DTO/model helpers
│   ├── pipes/                  # Parameter and upload validation pipes
│   ├── store/                  # Request-scoped context store
│   ├── strategies/             # Passport access, refresh, and local strategies
│   └── validators/             # Custom class-validator validators
├── config/                     # Environment, database, docs, logging, metrics, permissions, storage config
├── modules/
│   ├── api/                    # HTTP-facing modules and controllers
│   │   ├── app/                # Root, health, readiness, info, system, metrics, and test endpoints
│   │   └── v1/                 # Versioned API modules
│   │       ├── account/        # Authenticated account/profile management endpoints
│   │       ├── administration/ # Platform/admin endpoints
│   │       ├── authentication/ # Register, sign-in, sign-out, and refresh endpoints
│   │       ├── creator/        # Creator-facing controllers, services, and request models
│   │       ├── library/        # Reference-data endpoints
│   │       ├── public/         # Public-facing controllers, services, and request models
│   │       └── security/       # CSRF/security endpoints
│   ├── domain/                 # Business/domain modules
│   │   ├── identity/           # Users, credentials, profiles, addresses, auth models, repository, service
│   │   └── library/            # Countries, regions, time zones, genders, account statuses, roles, permissions
│   └── system/                 # Infrastructure modules
│       ├── configuration/      # Global Nest config module and typed env provider
│       ├── database/           # TypeORM module and database status service
│       ├── email/              # Postmark provider, email service, templates, and email models
│       ├── seeder/             # Reusable database seeding infrastructure
│       └── tokens/             # JWT/refresh/CSRF token services and configuration
└── main.ts                     # Application entrypoint and lifecycle startup

test/
├── e2e/                        # E2E tests
├── helpers/                    # Test app helpers
├── jest-e2e.json               # E2E Jest config
└── setup-env.ts                # Test environment bootstrap
```

---

## Article API audiences

Article API controllers, services, and audience-specific request models are grouped under `src/modules/api/v1/public/articles`, `creator/articles`, and `administration`. Each audience module is routed independently. Shared article query and outbound models, application rules, and persistence remain in the articles domain module.

- Public reads: `/api/v1/public/articles` and `/api/v1/public/articles/:id`.
- Creator reads and creation: `/api/v1/creator/articles`; detail and updates: `/api/v1/creator/articles/:id`; hero replacement, submission, and withdrawal: `/:id/hero`, `/:id/submit`, and `/:id/withdraw` beneath that creator collection.
- Administration: `/api/v1/administration/articles`, including `/:id/publish` and the other review/lifecycle actions.

This is a breaking route change: the former `/api/v1/articles` public routes and `/api/v1/articles/creator` creator routes are no longer mounted. Clients must update their URLs when adopting this release; no temporary aliases are provided. Swagger groups article operations as Public Articles, Creator Articles, and Article Administration.

Creator and administration article list/detail and mutation responses include a numeric `version`. Send that value as `expected_version` for content updates, hero replacements (a multipart field), submission/withdrawal, and administration lifecycle actions. A successful mutation increments the article version, including hero-only and unchanged-content edits. Missing or invalid versions fail request validation; stale versions return `409 Conflict` without mutation or an audit event. On conflict, reload and reconcile the article before retrying rather than blindly retrying the stale edit. Public article responses do not expose the version. Apply the article-version migration before deploying this contract; existing articles start at version 1.

---

### Article listing indexes

Migration `1791562871407-migration` adds three indexes matching the existing repository filters and deterministic ordering: public `(status_id, publishedAt, id)`, creator `(author_id, createdAt, id)`, and administration review `(status_id, createdAt, id)`. Entity metadata uses the corresponding embedded property paths. Both ASC and DESC ordering use the same indexes; no combined author/status or search index is added without measurements. Leading-wildcard title/summary searches are not made indexable by these indexes, and unfiltered administration ordering is a separate access pattern.

The article E2E suite includes an EXPLAIN verification case with 16,000 synthetic articles, skewed statuses, selective authors and tied dates. It captures the actual TypeORM DISTINCT/eager-join pagination SQL and refreshes statistics without logging plans to the console. For public, creator and review lists in both directions, it checks that the intended index is eligible and that MySQL uses an indexed filter prefix; it does not mandate a particular optimizer choice. It also exercises combined author/status and unfiltered administration queries without assuming an extra index is warranted. Index eligibility/filtering is not proof that the joined pagination avoids sorting or that every added index is beneficial in production.

The supplied local public-ASC plan considered the public index but chose the review index for `status_id` filtering. It still used temporary-table/filesort pagination and eagerly joined author/publisher profiles, roles and permissions before limiting results. This is a real query-shape concern, not a missing index or a reason to FORCE INDEX. A separate optimization should paginate/count the lean article scope first, then hydrate only the selected page's required display relations. These indexes alone do not solve eager-join amplification; validate the remaining scenarios locally before declaring query optimization complete.

After configuring the disposable test environment described below, run just that check manually:

```powershell
node --no-warnings --experimental-vm-modules ./node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand --runTestsByPath test/e2e/articles/articles.e2e-spec.ts --testNamePattern="EXPLAINs actual article pagination SQL"
```

Global setup resets only the explicitly configured disposable test schema and applies the migration. The revised checks have not been run here; they are supplied for local execution. Validate plans against realistic cardinalities before deployment; a failing eligibility/filtering assertion is a signal to revisit the index/query rather than add FORCE INDEX. The down migration preserves foreign-key supporting indexes if InnoDB replaced their implicit indexes with these composites. Index creation can lock/work on a large table: schedule the production migration appropriately.

The index rollback inspects the live schema and preserves surviving foreign-key supporting indexes, or restores them for `author_id` and `status_id` before dropping the listing indexes. It skips already-missing listing indexes so an interrupted rollback can resume: MySQL DDL implicitly commits, so a logged `ROLLBACK` does not restore a previously dropped index. The compiled migration revert/forward smoke check exercises this deployment boundary without tests importing individual migration classes.

### Article search contract

All article audiences use the same domain search policy: a literal substring in **title or summary**, never body. `%`, `_`, `!`, backslashes and quotes are ordinary search text, not wildcard/operator syntax. SQL uses a bound parameter with an explicit `!` LIKE escape character. Queries are normalized to Unicode NFC, trimmed, and have runs of whitespace (including tabs/newlines) collapsed to one space. Whitespace-only input means no search filter. This is contiguous phrase matching, not independent keyword matching; stored content is not rewritten or whitespace-normalized. The API validates the raw query's 255-character limit before normalization.

Matching explicitly uses MySQL 8's `utf8mb4_0900_ai_ci` collation: case- and accent-insensitive according to that collation's Unicode comparison rules, regardless of the column's default collation. Public published-only visibility, creator ownership/status, and administration author/status filters apply independently to **both** title and summary branches, including their pagination counts. Search never expands the caller's authorized scope.

Policy/repository unit cases and the article E2E suite cover literal wildcard/escape characters, backslashes, SQL-looking text, blank input, whitespace, Unicode composition, case/accent matching, body exclusion and scoped title/summary results. These tests are supplied for manual local execution.

Keep this SQL approach until measured volume/latency justifies full-text indexes or a dedicated search service. Leading-wildcard substring search is not accelerated by ordinary title/summary indexes. Before changing engines, define any changes to tokenization, phrases, stopwords, ranking and short-word handling explicitly. Treat search results as candidate IDs only: independently enforce current visibility, status and ownership in the authoritative database before returning records or counts. Do not rely on a search index's potentially stale authorization data.

### Request idempotency

Article creation, creator hero replacement, administration publish/archive/restore, and account profile avatar/phone/address creation, replacement, and removal accept an optional `Idempotency-Key`. The profile routes are `POST` and `DELETE /api/v1/account/profile/{avatar,phone,address}`. Generate a fresh key for each intended action, then keep the same key and payload (including `expected_version` where required and identical image bytes/client filename) for network retries. Keys must contain 1–128 printable, non-whitespace ASCII characters and no commas. Requests without a key retain their existing behavior. Profile POST responses remain `201`, and profile DELETE responses remain `200`; other opted-in operations returning `204` replay without a response body.

Keys are scoped to the authenticated actor, operation, and HTTP method/resource path. For 24 hours, identical retries return the original JSON body and HTTP status, even if the resource has since changed. Replaying a profile delete does not delete a subsequently recreated avatar or contact. A replayed profile response is a historical snapshot, not current profile/session/permission state; fetch the current account when that distinction matters. A different payload using the same key returns `409 Conflict`; an overlapping request also returns `409` and can be retried with backoff after the first finishes. Authentication, permissions, CSRF protection, and rate limits still apply to retries. Validation and transaction failures roll back the claim so the action can be retried safely.

The reusable `Idempotent` decorator/interceptor and system idempotency service own this concern; controllers only opt in. When adding another operation, import `IdempotencyModule`, apply the decorator above any multipart interceptor, and use `runInTransaction` for all database mutations so they share the request transaction and lifecycle. Explicitly pass that transaction manager to downstream writes and audit calls. Identity and audit services resolve their default managers through `applicationManager`, so they also join the active application transaction; other services must explicitly opt in or receive the manager. Nontransactional external effects still need lifecycle compensation or an outbox; this is not a general guarantee of exactly-once delivery to external systems. This decorator is not suitable unchanged for anonymous authentication or token/cookie-issuing flows.

The MySQL implementation uses non-waiting connection-scoped advisory locks across API replicas and commits the action, audit events, and replay record together. Replay eligibility expires after 24 hours and retries do not extend expiry. Expired rows are swept hourly while the application is running, so physical removal can lag expiry; backups have their own retention. After expiry a reused key is a new action. Existing browser deployments must add `Idempotency-Key` to `CORS_ALLOWED_HEADERS`.

Profile response snapshots include personal information (email, date of birth, contacts, and display/session metadata) already present in `UserDto`. They do not contain password hashes or access/refresh tokens. The store persists a request fingerprint, not the request payload or uploaded bytes, and hashes the raw client key into the scope identifier. Restrict table/backup access as for identity data, encrypt database storage and backups operationally, and include snapshots in retention/erasure procedures. Expiry is not immediate account-erasure cleanup. Never opt credential/token responses into this full-response store without a separate security and replay policy.

Administrator user mutations also accept `Idempotency-Key`: `PATCH /api/v1/administration/users/:id` replays the original `200` user representation, and `POST /api/v1/administration/users/:id/delete` replays bodyless `204` after the target has been deleted. The key includes the administrator and target route; a changed reason/status/role payload conflicts. Update/deletion, the success audit, and the replay record commit together; avatar storage deletion happens after commit. Current authentication and endpoint permissions are checked on every retry. If the administrator deletes their own account or loses the required permission, replay does not bypass that loss of access.

User administration does not yet have an `expected_version` contract. Row locks serialize active transactions, and replaying an old completed key cannot overwrite a newer action. However, a stale edit submitted as a new action/key remains last-write-wins. Optimistic concurrency is a separate follow-up: introduce an administration version, expose it to editors, require it on update/deletion, and reject stale versions with `409`. Idempotency keys and request IDs are not substitutes for that version check. Administrator update snapshots contain the target's `UserDto` personal information and follow the same retention/access policy above.

### Identity security and durable email

Authentication/registration/password-reset and account security/session controllers use `SecurityOperation`: their handler writes, success audits, and email intents commit in one application transaction. Refresh-cookie changes are staged until commit and credential responses have `Cache-Control: no-store`. Guards still execute before this boundary. OTP failure counters and lockout deliberately commit using the root manager after the request transaction releases its connection/locks, but before completing the response. Rejecting a code cannot roll back its security accounting, and failed requests do not monopolize the pool while waiting for another connection. Outside application transactions, accounting is immediate.

Security endpoints **reject `Idempotency-Key` with `400`**, rather than store and replay JWTs, reset authorizations, or refresh cookies. Challenges are single-use: a rolled-back operation may retry; a committed operation with a lost credential response requires fresh sign-in or a new challenge. Concurrent refresh requests using an old credential cannot both rotate the session: the handler locks and compares the persisted refresh hash. Clients must serialize refreshes and sign in again after an ambiguous committed rotation. CSRF/authentication/authorization and throttling continue to apply.

Apply migration `1791892800000-email-outbox` before deploying these services. EmailService compiles and inserts an AES-256-GCM-encrypted MySQL intent in the same transaction, without depending on Redis availability. A five-second dispatcher publishes only a UUID delivery ID; deterministic Bull job IDs prevent duplicate queued work. Pending intents are reconsidered every minute, including exhausted or completed jobs, until expiry. Workers lock the intent, supply the same delivery ID in provider metadata, and erase ciphertext on delivery, cancellation, or expiry. New challenges cancel pending intents for the same subject/template/purpose; challenge intent expiry matches the actual challenge expiry. Cancellation cannot recall a message already accepted by the provider.

All API/worker replicas must use the same stable `CRYPTO_SECRET`. Do not rotate it while encrypted pending intents remain: drain them or implement an explicit key-version migration first. Challenge email secrets and recipients are encrypted, cancellation scopes use keyed hashes, new Redis jobs contain only identifiers, and new delivery failures expose only a generic error. Legacy compiled-payload jobs are still supported for deployment draining; remove those legacy jobs/DLQ records according to the existing privacy policy. Restrict database, queue-dashboard, and backup access. Non-challenge intents expire after 24 hours; the sweep erases expired payloads and removes non-pending tombstones 24 hours after their original expiry, with possible sweep lag. Backups have separate retention.

Delivery is **at-least-once, not exactly-once**: provider acceptance followed by a timeout or a database commit failure can result in another send. The stable metadata identifier supports tracing, not a promise of provider-side deduplication. Monitor pending-intent age, expired/cancelled intent counts, worker failures and DLQ volume; alert before challenge expiry. Redis dispatch waits are bounded to avoid indefinitely retaining transaction locks. SMTP/provider outages can still delay or expire notification delivery.

### Hardening verification and rollout gate

Success audits represent committed domain/security lifecycle mutations, not each HTTP retry. An identical completed keyed retry returns its historical response without a new audit or storage mutation. Failed/stale/unauthorized actions must not leave a success event. Registration confirmation emits its registration event rather than an extra sign-in event; ordinary refresh intentionally has no success audit. Filter assertions by event and resource/subject, or capture a baseline: authentication/setup can legitimately create additional events. Request IDs correlate HTTP attempts; they are not deduplication keys or aggregate versions.

The regression suites cover these boundaries:

| Boundary | Regression suite |
| --- | --- |
| Cross-connection claims, rollback, bodyless 204, retention/expiry | `test/e2e/idempotency/idempotency.e2e-spec.ts` |
| Permission loss on replay, transactional audits, concurrent deletion and storage cleanup | `test/e2e/administration/users.e2e-spec.ts` |
| Avatar/contact replay, recreated contacts, temporary uploads and upload compensation | `test/e2e/account/profile.e2e-spec.ts` |
| Concurrent optimistic edits, lifecycle actions, ownership and hero rollback | `test/e2e/articles/articles.e2e-spec.ts` |
| Single-use challenges, OTP lockout, authentication and security rollback | `test/e2e/authentication/{registration,email-verification,mfa,password-reset,sessions}.e2e-spec.ts` |
| Encrypted intent, cancellation rollback, expiry, provider retry and real Redis worker delivery | `test/e2e/authentication/security-delivery.e2e-spec.ts` |

Run the full suite against a disposable migrated schema, never the development/production database. `npm run test:infra:up` starts the isolated MySQL 8.4/Redis services. On POSIX shells use `npm run test:e2e:local`; on PowerShell set the explicit test variables first:

```powershell
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

Global setup validates the explicit test-schema match, then drops, migrates and seeds **that disposable schema**. Run unit tests, lint, type-checks and build as well; an unavailable dependency or a suite that never reached its tests is not a passing result. CI uses the same MySQL 8.4/Redis topology. The real-delivery regression uses a uniquely named test queue and mocked provider, and removes only its own queue after completion.

Before rollout: require green complete E2E/CI evidence for the exact release commit; back up the production schema; apply all pending migrations (including the request-idempotency migration and `1791892800000-email-outbox`) before updating API/workers; maintain the same `CRYPTO_SECRET` across replicas; and update browser CORS headers and client retry policies. In staging, verify permission removal still blocks a replay, old refresh cookies are rejected, a controlled queue/provider outage recovers the same delivery ID, expired codes are not sent, and `/ready` is healthy. Do not send production credentials or real recipient emails from these regression tests.

Storage compensation is not a durable cleanup queue: deletion is retried three times, and exhausted post-commit cleanup errors are surfaced/logged while the database mutation, audit and replay record remain committed. Retrying the same key returns the committed response and does **not** rerun cleanup. Resolve leaked object keys operationally and monitor cleanup errors; durable storage-deletion/reconciliation is a separate follow-up. A process crash between upload and compensation can also leave an orphan. Email provider acceptance followed by timeout/commit failure likewise remains an at-least-once boundary, not an exactly-once guarantee.

Retention sweeps and Bull age-based auto-removal are not immediate physical erasure (Bull cleanup is opportunistic on subsequent job completions/failures). Include backups and legacy queues in privacy/erasure procedures. Stale administrator edits remain last-write-wins without an `expected_version` contract. Release rollback must not drop outbox/idempotency tables containing live intent or replay data: roll back application versions compatibly, preserve the encryption secret, and drain compatible workers. Monitor pending age/expiry, queue failures/DLQ, lock conflicts and storage-cleanup failures during the rollout.

## API Structure

Routes are composed in layers:

```bash
/                         # Root/system app endpoints
/health                   # Liveness check
/ready                    # Readiness result (dependency details are private)
/info                     # Public application name and version
/system                   # Protected, opt-in system diagnostics
/metrics                  # Protected, opt-in Prometheus metrics
/docs                     # Opt-in Swagger UI
/docs-json                # OpenAPI JSON

/api/v1/security          # CSRF and browser request-security endpoints
/api/v1/authentication    # Registration, sign-in, sign-out, refresh
/api/v1/account           # Current-user account, profile, country, timezone, address, phone, and avatar management
/api/v1/administration    # Admin/platform user-management endpoints
/api/v1/library           # Countries, time zones, genders, statuses, roles, permissions, and reference data
```

Swagger UI is available at:

```bash
https://localhost:8080/docs
```

OpenAPI JSON is available at:

```bash
https://localhost:8080/docs-json
```

### Reference Data Endpoints

Public reference data endpoints live under `/api/v1/library` and are intended for front-end form options and shared client/server keys.

| Endpoint                        | Purpose                                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/library/countries` | Countries with available country-specific regions and validation metadata for addresses and phones.             |
| `GET /api/v1/library/timezones` | IANA time zone reference records seeded from JavaScript `Intl`; each record uses the IANA key as its stable ID. |
| `GET /api/v1/library/genders`   | Gender reference options for registration and profile forms.                                                    |
| `GET /api/v1/library/statuses`  | Account status reference data for account lifecycle displays.                                                   |
| `GET /api/v1/library/roles`     | Role reference data for administration and access-management screens.                                           |

---

## Environment Configuration

This project uses Zod-backed environment validation. The app validates configuration at startup and exits early if required values are missing or invalid.

Start by copying the example file:

```bash
cp .env.example .env
```

The full environment shape is documented in `.env.example`.

Important production rule:

```env
DB_SYNC="false"
```

`DB_SYNC=true` is rejected when `NODE_ENV=production`. Schema changes should be applied through TypeORM migrations.

### Local Docker MySQL Environment

When running the app on the host machine against Docker MySQL, use:

```env
DB_HOST="localhost"
DB_PORT="3307"
DB_USER="quickapi_app"
DB_PASSWORD="quickapi_password"
DB_DATABASE="quickapi"
DB_SYNC="false"
DB_SSL="false"
```

When the API itself runs inside Docker Compose, `docker-compose.yml` overrides the database host and port:

```env
DB_HOST="mysql"
DB_PORT="3306"
```

---

## Disposable local E2E dependencies

The dedicated test Compose stack runs only MySQL and Redis. It uses the
`quickapi_test` database, test-specific credentials and host ports (`3308` and
`6380`), and volumes that are separate from local development data.

```bash
# Start both dependencies and wait for their health checks.
npm run test:infra:up

# Apply the deployment migrations to the disposable database, then run E2E tests.
npm run test:db:prepare
npm run test:e2e:local
```

If startup or a test fails, inspect dependency state and the recent logs:

```bash
docker compose -f docker-compose.test.yml ps
npm run test:infra:logs
```

Destroy the stack when finished. This removes only the containers, network, and
named volumes declared by `docker-compose.test.yml`; it does not touch the
ordinary development stack or its data.

```bash
npm run test:infra:down
```

---

## Environment Variables (`.env`)

```bash
# ============================================================
# App
# ============================================================

APP_NAME="quickapi-nestjs"
APP_VERSION="1.0.0"
PUBLIC_API_URL="https://localhost:4000"
PUBLIC_WEB_URL="https://localhost:5173"

NODE_ENV="test"
PORT="4000"
LOG_LEVEL="silent"


# ============================================================
# CORS
# ============================================================

CORS_ORIGINS="http://localhost:5173"
CORS_METHODS="GET,POST,PUT,PATCH,DELETE"
CORS_ALLOWED_HEADERS="Content-Type,Authorization,X-CSRF-Token,Idempotency-Key"
CORS_EXPOSED_HEADERS="Authorization,Set-Cookie"
CORS_CREDENTIALS="true"
CORS_MAX_AGE_SECONDS="86400"


# ============================================================
# HTTPS
#
# For local development or reverse-proxy TLS termination:
# HTTPS_ENABLED="false"
#
# If the Nest app owns TLS directly:
# HTTPS_ENABLED="true"
# HTTPS_KEY_PATH and HTTPS_CERT_PATH must be set.
# ============================================================

HTTPS_ENABLED="false"
HTTPS_KEY_PATH="certs/localhost-key.pem"
HTTPS_CERT_PATH="certs/localhost.pem"


# ============================================================
# Cookies
# ============================================================

COOKIE_SECURE="false"
COOKIE_SAME_SITE="strict"
COOKIE_PATH="/"
COOKIE_DOMAIN=""

REFRESH_COOKIE_NAME="refresh_token"
REFRESH_COOKIE_MAX_AGE_DAYS="7"

CSRF_COOKIE_NAME="csrf_token"
CSRF_COOKIE_MAX_AGE_MINUTES="15"


# ============================================================
# Static files
# ============================================================

STATIC_SERVE_ENABLED="false"
STATIC_ROOT_PATH="public"
STATIC_SERVE_ROOT="/"


# ============================================================
# Uploads
# ============================================================

UPLOAD_TMP_DIR="tmp"


# ============================================================
# Runtime limits
# ============================================================

RATE_LIMIT_WINDOW_MS="60000"
RATE_LIMIT_MAX="200"

REQUEST_TIMEOUT_MS="5000"
REQUEST_BODY_LIMIT_BYTES="1048576"

HEADER_MAX_COUNT="100"
HEADER_MAX_SINGLE_BYTES="4096"
HEADER_MAX_TOTAL_BYTES="8192"
HEADER_ALLOW_CHUNKED="false"

ALLOWED_HTTP_METHODS="GET,POST,PUT,PATCH,DELETE"
ALLOWED_CONTENT_TYPES="application/json,multipart/form-data"

GLOBAL_THROTTLE_TTL_MINUTES="1"
GLOBAL_THROTTLE_LIMIT="200"


# ============================================================
# Database
#
# Local Docker Compose default:
# DB_HOST="localhost"
# DB_PORT="3307"
#
# GitHub Actions / direct MySQL default:
# DB_PORT="3306"
#
# Production must use DB_SYNC="false".
# Schema changes should be applied through migrations.
# ============================================================

DB_HOST="localhost"
DB_PORT="3307"
DB_USER="quickapi_app"
DB_PASSWORD="quickapi_password"
DB_DATABASE="quickapi"

DB_SYNC="false"
DB_SEED="false"
DB_MIGRATIONS_RUN="false"

DB_SSL="false"
DB_SSL_REJECT_UNAUTHORIZED="true"

DB_POOL_CONNECTION_LIMIT="10"
DB_POOL_WAIT_FOR_CONNECTIONS="true"
DB_POOL_QUEUE_LIMIT="100"
DB_CONNECT_TIMEOUT_MS="10000"
DB_SLOW_QUERY_LOG_MS="1000"

# ============================================================
# Auth / Tokens
#
# Generate three distinct values from at least 32 random bytes. Store them in
# the gitignored environment file; do not commit them or bake them into the
# container image.
# ============================================================

JWT_SECRET_KEY="__REPLACE_JWT_SECRET_KEY_BEFORE_DEPLOYMENT__"
REFRESH_SECRET_KEY="__REPLACE_REFRESH_SECRET_KEY_BEFORE_DEPLOYMENT__"
CRYPTO_SECRET="__REPLACE_CRYPTO_SECRET_BEFORE_DEPLOYMENT__"

JWT_EXPIRY_TIME="15m"
REFRESH_EXPIRY_TIME="7d"

# ============================================================
# Email / Postmark
# ============================================================

POSTMARK_ENABLED="false"
POSTMARK_SERVER_TOKEN="__REPLACE_POSTMARK_SERVER_TOKEN_BEFORE_DEPLOYMENT__"
POSTMARK_FROM_EMAIL="noreply@example.com"
POSTMARK_MESSAGE_STREAM="outbound"

# ============================================================
# Storage / Cloudflare R2
# ============================================================

STORAGE_DRIVER="local"
R2_ACCOUNT_ID="__REPLACE_R2_ACCOUNT_ID_BEFORE_DEPLOYMENT__"
R2_ENDPOINT="https://r2-account-id.r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID="__REPLACE_R2_ACCESS_KEY_ID_BEFORE_DEPLOYMENT__"
R2_SECRET_ACCESS_KEY="__REPLACE_R2_SECRET_ACCESS_KEY_BEFORE_DEPLOYMENT__"
R2_BUCKET_NAME="quickapi-dev"
R2_PUBLIC_BASE_URL="https://pub-example.r2.dev"

# ============================================================
# Redis
# ============================================================

REDIS_HOST="127.0.0.1"
REDIS_PORT="6379"
REDIS_PASSWORD=""

# ============================================================
# BullBoard
# ============================================================

BULL_BOARD_ENABLED=true
BULL_BOARD_ROUTE="/admin/queues"
```

Each variable is validated at startup using Zod. The application exits early with formatted validation errors if the environment is incomplete or invalid.

> **Note:** `DB_SYNC` controls TypeORM schema synchronization. Keep this disabled for production-like environments and use migrations/schema-management workflows instead.

---

## Local HTTPS Certificates

Local HTTPS is supported by mounting certificate files into the Docker container or by using local certificate paths when running the app directly.

Expected local certificate paths:

```bash
certs/localhost-key.pem
certs/localhost.pem
```

Recommended local HTTPS settings:

```env
PUBLIC_API_URL="https://localhost:4000"
HTTPS_ENABLED="true"
HTTPS_KEY_PATH="certs/localhost-key.pem"
HTTPS_CERT_PATH="certs/localhost.pem"
COOKIE_SECURE="true"
```

Certificate files should not be committed to Git. The `certs/` folder may contain a `.gitkeep` placeholder, but real cert files should remain local.

For production behind a reverse proxy or load balancer, the app may run without owning TLS directly:

```env
HTTPS_ENABLED="false"
COOKIE_SECURE="true"
PUBLIC_API_URL="https://api.example.com"
```

---

## Local Docker Infrastructure

The local Docker setup provides **MySQL**, **Redis**, and an optional **API** container.
`docker-compose.yml` is explicitly development-only: it publishes database
ports, contains disposable local credentials, and mounts source-tree folders.
Never merge or deploy it in staging. The standalone `docker-compose.staging.yml`
contains the staging topology.

Start MySQL and Redis:

```bash
npm run docker:mysql:up
npm run docker:redis:up
npm run docker:status
```

Tail infrastructure logs as needed:

```bash
npm run docker:mysql:logs
npm run docker:redis:logs
```

Stop infrastructure services:

```bash
npm run docker:mysql:stop
npm run docker:redis:stop
```

Run migrations against Docker MySQL from the host machine:

```bash
npm run migration:run
npm run migration:show
```

Start the API container:

```bash
npm run docker:api:up
npm run docker:api:logs
```

Check readiness:

```bash
curl -k https://localhost:4000/ready
```

The `-k` flag is useful for local self-signed certificates.

### Runtime Folders

The API uses local runtime folders for public assets and temporary uploads:

```bash
public/
tmp/
```

These folders are mounted into the API container. Generated contents should not be committed to Git.

---

## Database & Migrations

QuickAPI-NestJS uses **TypeORM + MySQL** with migration-based schema management.

Migration commands:

```bash
npm run migration:show
npm run migration:generate
npm run migration:run
npm run migration:revert
```

Recommended local workflow:

1. Update entities.
2. Generate a migration.
3. Review the generated migration.
4. Run it locally.
5. Confirm the app starts with `DB_SYNC=false`.

```bash
npm run migration:generate
npm run migration:run
npm run migration:show
```

For disposable local/test databases, verify that migrations can revert and re-run:

```bash
npm run migration:revert
npm run migration:show
npm run migration:run
npm run migration:show
```

Production schema changes should be explicit, reviewed, and applied through migrations. Use `migration:revert` only when rollback is safe. For destructive schema changes, prefer a reviewed forward-fix migration after backup review.

---

## Database & Seeding

QuickAPI-NestJS uses **TypeORM + MySQL** with auto-loaded entities. Domain modules register their entities through `TypeOrmModule.forFeature(...)`, while the root database module owns the TypeORM connection.

Reference data is seeded through the shared seeding infrastructure and feature seeders for:

- Countries and country-specific regions
- Time zones from the JavaScript `Intl` API
- Genders
- Account statuses
- Permissions
- Roles

Time zone records use the IANA key the stable `key` value, for example `America/Toronto`. The seed data also stores English display labels, long and short time zone names, GMT offset metadata, top-level region, and exemplar city so developers and clients have useful context while still referencing one canonical key.

Seeding is controlled by the `DB_SEED` environment variable.

---

## Authentication & Authorization

The authentication stack includes:

- Local credential validation for sign-in
- JWT access-token strategy
- Refresh-token strategy
- HTTP-only refresh-token cookie handling
- CSRF token issuance and guard support
- Permission decorators and permission guard enforcement
- Platform-admin decorator support for administrative endpoints

The account and administration APIs rely on the same shared identity/domain layer, keeping controllers thin and business logic centralized in services and repositories.

---

## Distributed rate limiting and reverse proxies

Nest's throttler stores counters in the same Redis service used by BullMQ, so
limits apply across every API replica rather than independently per process.
The authentication policies are intentionally separate: sign-in is 5/minute,
registration is 3/minute, registration resend is 2/minute, password-reset
request is 3/minute, and OTP confirmation is 5/minute per client and route.

Client identity is taken from Express `req.ip`. By default `TRUST_PROXY` is
empty and forwarded headers are ignored. In production, set `TRUST_PROXY` to a
comma-separated allowlist of the IP addresses or CIDR ranges from which the API
actually receives load-balancer connections. The load balancer must:

1. connect from an address in that allowlist;
2. remove any client-supplied `X-Forwarded-For` header; and
3. write `X-Forwarded-For` as the original client address followed by any
   trusted proxy hops.

Do not configure `TRUST_PROXY=true`, `0.0.0.0/0`, or `::/0`, and do not expose
an alternate network path directly to the API. Requests from peers outside the
allowlist are identified by their socket address, so a forged forwarded header
cannot create a fresh rate-limit identity.

When a policy is exceeded, the API responds with **HTTP 429** and:

- `Content-Type: application/json`;
- `Retry-After: <seconds>` indicating when the block expires;
- `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`
  headers; and
- the standard error body
  `{ "status": 429, "message": "ThrottlerException: Too Many Requests", "timestamp": <unix milliseconds> }`.

Redis availability is required for request throttling. This is deliberately
fail-closed rather than silently falling back to process-local counters.

---

## Email Queueing (BullMQ + Redis)

Background email delivery runs through BullMQ-backed queues with Redis transport.

Key points:

- API requests enqueue email work; processors handle delivery asynchronously.
- Failed jobs are retried based on queue policy and can be moved to a dead-letter flow.
- Bull Board integration is available for queue inspection in development/operations environments.

If running locally with Docker Compose, ensure Redis is up before queue-dependent flows:

```bash
npm run docker:redis:up
```

---

## Observability & Operations

Built-in operational endpoints include:

| Endpoint   | Purpose                                               |
| ---------- | ----------------------------------------------------- |
| `/health`  | Process liveness check                                |
| `/ready`   | Aggregate readiness result for platform probes        |
| `/info`    | Intentionally public application name and version     |
| `/system`  | Protected runtime and dependency diagnostics (opt-in) |
| `/metrics` | Protected Prometheus-formatted metrics (opt-in)       |

`/health` and `/ready` remain unauthenticated for platform probes, but do not
return dependency identities or failure details. Set `METRICS_ENABLED=true` or
`DETAILED_DIAGNOSTICS_ENABLED=true` independently and send the non-user
deployment credential in `X-Operations-Key`. Disabled operational endpoints
return 404; missing or invalid credentials return 401. Swagger is only mounted
when `DOCUMENTATION_ENABLED=true`.

The Prometheus registry collects default Node.js metrics and custom HTTP request counters/duration histograms when metrics are enabled.

## Quality Checks

Run the baseline quality gate:

```bash
npm run check
```

This runs:

- Prettier formatting check
- ESLint
- TypeScript typecheck
- Unit tests
- Production build

Run E2E tests:

```bash
npm run check:e2e
```

### Session IP geolocation

Refresh-token session metadata stores the trusted request IP and a coarse GeoLite2-derived country, region, and city when available. It never calls an external geolocation service during authentication, and does not retain coordinates. Set `MAXMIND_LICENSE_KEY` (and optionally `MAXMIND_ACCOUNT_ID`) and install/update the local databases with:

```bash
npm run geoip:update
```

Databases are kept in `IP_LOCATION_DATA_DIR` (default `data/geoip`; mount this directory as persistent storage in containers). Run the command as a deployment migration or scheduled job before starting/rolling application instances; it validates and replaces the local files with the current download. The API refuses to start when either database is unavailable or unreadable. GeoLite2 City is seeded in addition to Country because Country cannot provide city or region fields.

---

## Continuous Integration

GitHub Actions runs two CI jobs:

1. **Check**
   - install dependencies
   - format check
   - lint
   - typecheck
   - unit tests
   - build

2. **Migration Check**
   - start MySQL service
   - run migrations
   - show migration status
   - revert migrations
   - run migrations again
   - run E2E readiness tests against the migrated database

This proves that a fresh CI environment can install the project, validate it, build it, create the database schema from migrations, and run the readiness E2E test.

---

## Development Scripts

| Script                      | Description                                       |
| --------------------------- | ------------------------------------------------- |
| `npm run start`             | Start the Nest application through the Nest CLI   |
| `npm run start:dev`         | Start development server with watch mode          |
| `npm run start:debug`       | Start development server with debugger/watch mode |
| `npm run build`             | Compile the Nest application to `dist/`           |
| `npm run start:prod`        | Start the compiled application from `dist/main`   |
| `npm run format`            | Format TypeScript sources using Prettier          |
| `npm run format:check`      | Check formatting without writing changes          |
| `npm run lint`              | Run ESLint                                        |
| `npm run lint:fix`          | Run ESLint with auto-fix                          |
| `npm run typecheck`         | Run TypeScript without emitting files             |
| `npm test`                  | Run unit tests                                    |
| `npm run test:e2e`          | Run E2E tests                                     |
| `npm run check`             | Run baseline local quality gate                   |
| `npm run check:e2e`         | Run baseline quality gate and E2E checks          |
| `npm run migration:show`    | Show TypeORM migration status                     |
| `npm run migration:run`     | Run pending TypeORM migrations                    |
| `npm run migration:revert`  | Revert the latest TypeORM migration               |
| `npm run docker:build`      | Build the production Docker image                 |
| `npm run docker:mysql:up`   | Start local Docker MySQL                          |
| `npm run docker:api:up`     | Start the API container                           |
| `npm run docker:redis:up`   | Start local Docker Redis                          |
| `npm run docker:redis:stop` | Stop local Docker Redis                           |
| `npm run docker:redis:logs` | Tail local Docker Redis logs                      |
| `npm run docker:status`     | Show Docker Compose service status                |

---

## Production / Staging Notes

This template is designed to support a staging-to-production workflow, but hosting details are intentionally environment-specific.

Recommended deployment contract:

- Build the Docker image from the repository.
- Inject secrets and environment variables through the hosting platform.
- Run database migrations before or during deployment.
- Keep `DB_SYNC=false` in production.
- Use HTTPS publicly.
- Set `COOKIE_SECURE=true` for HTTPS environments.
- Use `/ready` for readiness checks.
- For staging, keep `DOCUMENTATION_ENABLED=false`, `METRICS_ENABLED=true`, and
  `DETAILED_DIAGNOSTICS_ENABLED=false` by default. Give the metrics scraper a
  randomly generated `OPERATIONS_TOKEN` (at least 32 characters), send it as
  `X-Operations-Key`, and additionally restrict operational routes to a private
  network at the ingress when possible. Temporarily enable documentation or
  detailed diagnostics only when needed.
- Do not bake `.env`, certificates, runtime uploads, or local temp files into the image.

### Staging Compose contract

Run the staging definition **by itself** after the deployment platform has
exported its configuration and secrets (for example, from a secret-manager
sidecar or CI secret context):

```bash
cp .env.staging.example .env.staging # then inject secrets and deployment values
npm run staging:preflight
docker compose --env-file .env.staging -f docker-compose.staging.yml config --quiet
docker compose --env-file .env.staging -f docker-compose.staging.yml run --rm migration
docker compose --env-file .env.staging -f docker-compose.staging.yml up -d api
```

Use an immutable tag or digest for `QUICKAPI_IMAGE`. The compose file refuses to
render without database, Redis, token, operations, email, GeoIP, and object-store
credentials. It also requires the actual HTTPS `PUBLIC_API_URL`, HTTPS
`PUBLIC_WEB_URL`/`CORS_ORIGINS`, the external `INGRESS_NETWORK`, and a narrow
`TRUST_PROXY` ingress address or CIDR allowlist. Do not use localhost, example
domains, a wildcard CORS origin, or a trust-all proxy setting.

### Release images and supply-chain evidence

After the `CI` workflow succeeds on `main` or `staging`, the
`.github/workflows/release-image.yml` workflow builds the production image once
and pushes that manifest with the full commit SHA and `package.json` version
tags. Set the repository variables `CONTAINER_REGISTRY` and
`CONTAINER_REPOSITORY` to select a registry/repository (they default to GHCR and
the GitHub repository name). Non-GHCR registries require the environment secrets
`REGISTRY_USERNAME` and `REGISTRY_PASSWORD`.

For a named staging release, dispatch the workflow with the full SHA of a commit
that already passed CI and an optional OCI-compatible `staging-release` tag.
Automated runs can instead read `STAGING_RELEASE_IDENTIFIER` from repository
variables. Tags are convenient discovery aliases only: deployment automation
must download the `release-image.env` evidence artifact and inject its
`QUICKAPI_IMAGE=registry/repository@sha256:...` value into `.env.staging`. The
migration, GeoLite initializer, preflight, and API services all pull that exact
digest; the staging Compose definition has no local build fallback.

The image carries OCI source, revision, version, and creation-time labels and a
BuildKit provenance/SBOM attestation. The workflow also publishes an SPDX JSON
SBOM, high-severity report, critical SARIF report, and the exception register as
release evidence. Any critical vulnerability fails the release. High-severity
exceptions must be recorded in
`security/container-vulnerability-exceptions.md` with an owner, approval,
mitigation, and expiry; currently no exceptions are accepted.

MySQL and Redis are attached only to the internal `private` network and have no
host-published ports. The API exposes port 4000 to its Docker networks but does
not publish it on the host. The ingress is the only public entry point: it must
terminate TLS, strip untrusted forwarding headers, connect through the named
external network, and proxy plain HTTP to port 4000. Consequently application
TLS is disabled while secure cookies remain enabled. The API health check probes
`/health`; configure the ingress/orchestrator readiness probe to use `/ready`.

The `preflight` service loads and validates `.env.staging` and must finish successfully before the migration or GeoLite jobs can run. Those jobs, in turn, must finish before the API deployment. Targeted deployment automation must run `npm run staging:preflight` first as shown above.

The one-shot `migration` service uses the same immutable image and database
configuration as the API. It must complete successfully before API replacement;
the Compose dependency enforces this for a full `up`, while deployment tooling
must preserve the ordering for targeted updates. Never enable `DB_SYNC`.

The one-shot `geoip-init` service uses that same immutable API image and writes
validated GeoLite2 Country and City databases to `quickapi_geoip` before the API
starts. Populate a new staging volume (or update an existing one) with:

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml run --rm geoip-init
docker compose --env-file .env.staging -f docker-compose.staging.yml up -d api
```

Set `MAXMIND_ACCOUNT_ID`, `MAXMIND_LICENSE_KEY`, and
`IP_LOCATION_DATA_DIR=/app/data/geoip` in `.env.staging`. Schedule the first
command as a weekly one-shot staging job (MaxMind publishes GeoLite updates on
Tuesdays), then restart the API so its readers open the new files. A failed
download, archive extraction, or database validation exits nonzero and leaves
the last valid pair in place. The updater alone has read-write volume access;
the API keeps its mount read-only.

For local development, `npm run geoip:update` loads the repository `.env`
automatically. `MAXMIND_LICENSE_KEY` is required; `MAXMIND_ACCOUNT_ID` is
optional for the GeoLite download endpoint.

### Persistence, sizing, backups, and rollback

- `quickapi_mysql_data` is the authoritative relational-data volume;
  `quickapi_redis_data` retains queues and rate-limit state. `quickapi_uploads`
  holds local-driver assets, `quickapi_geoip` is populated by the GeoIP update
  job, and `quickapi_tmp` is scratch space and is not backed up. Prefer the R2
  storage driver for durable user assets and treat Redis as reconstructable
  unless queue recovery is a business requirement.
- The platform/database owner owns encrypted MySQL backups, restore tests,
  retention, and point-in-time recovery. The application owner owns R2/uploads
  retention and validates restored object/database consistency. The operations
  owner owns Redis backup policy when queued jobs must survive a total loss.
  Snapshot persistent volumes only with application-consistent tooling; copying
  live volume files is not a valid backup.
- Start staging near the local baseline (API 0.5 CPU/512 MiB, MySQL 1 CPU/2 GiB
  with a 512 MiB buffer pool, Redis 0.25 CPU/256 MiB), then set platform-level
  requests and limits from measured latency, connection, queue, and memory data.
  Compose resource flags are intentionally omitted because enforcement differs
  between Docker Compose and orchestrators. Keep Node's heap below its container
  memory limit and size the database pool across all replicas below MySQL's
  connection ceiling.
- Before migration, take and verify a restorable database backup and record the
  current immutable image. Roll back application instances to that image only
  when migrations are backward compatible. Use a reviewed TypeORM revert only
  when its data effects are understood; otherwise restore the backup during a
  maintenance window or deploy a forward-fix migration. A failed migration
  blocks rollout, and a failed `/ready` check triggers deployment rollback; do
  not delete or automatically roll back persistent volumes with the application.

---

## License

MIT License — free for personal and commercial use.

---

QuickAPI-NestJS — part of the **QuickAPI** template ecosystem by **John Desjardins**.
