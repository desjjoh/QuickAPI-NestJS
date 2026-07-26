# QuickAPI-NestJS

A modular, production-minded NestJS API template designed for rapid backend service creation and long-term maintainability. Implements consistent architecture patterns from the **QuickAPI family** — including Express, FastAPI, and others — emphasizing layered modules, strict validation, observability, authentication, persistence, and graceful lifecycle management.

---

## Features

- **NestJS 11 + TypeScript-first architecture** with decorators, modules, dependency injection, and path aliases
- **Layered module structure** split into System, Domain, and API boundaries
- **Versioned REST API** under `/api/v1` with dedicated security, authentication, account, administration, and library modules
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
├── common/                    # Shared framework primitives used across the application
│   ├── constants/             # Time and byte constants
│   ├── decorators/            # Auth, permission, upload, and parameter decorators
│   ├── entities/              # Shared entity base classes and value objects
│   ├── errors/                # Non-HTTP operational/config errors
│   ├── exceptions/            # HTTP/application exception models
│   ├── filters/               # Global and not-found exception filters
│   ├── guards/                # CSRF, JWT, refresh, local, and permission guards
│   ├── handlers/              # Lifecycle and file handlers
│   ├── helpers/               # Small utilities shared across modules
│   ├── interceptors/          # Global request timeout interceptor
│   ├── loggers/               # Nest-compatible logger implementation
│   ├── middleware/            # Logging, security, metrics, CORS, limits, and context middleware
│   ├── models/                # Shared DTO/model helpers
│   ├── pipes/                 # Parameter and upload validation pipes
│   ├── store/                 # Request-scoped context store
│   ├── strategies/            # Passport access, refresh, and local strategies
│   └── validators/            # Custom class-validator validators
├── config/                    # Environment, database, docs, logging, metrics, permissions, storage config
├── modules/
│   ├── api/                   # HTTP-facing modules and controllers
│   │   ├── app/               # Root, health, readiness, info, system, metrics, and test endpoints
│   │   └── v1/                # Versioned API modules
│   │       ├── account/       # Authenticated account/profile management endpoints
│   │       ├── administration/# Platform/admin endpoints
│   │       ├── authentication/# Register, sign-in, sign-out, and refresh endpoints
│   │       ├── library/       # Reference-data endpoints
│   │       └── security/      # CSRF/security endpoints
│   ├── domain/                # Business/domain modules
│   │   ├── identity/          # Users, credentials, profiles, addresses, auth models, repository, service
│   │   └── library/           # Countries, regions, time zones, genders, account statuses, roles, permissions
│   └── system/                # Infrastructure modules
│       ├── configuration/     # Global Nest config module and typed env provider
│       ├── database/          # TypeORM module and database status service
│       ├── email/             # Postmark provider, email service, templates, and email models
│       ├── seeder/            # Reusable database seeding infrastructure
│       └── tokens/            # JWT/refresh/CSRF token services and configuration
└── main.ts                    # Application entrypoint and lifecycle startup

test/
├── e2e/                       # E2E tests
├── helpers/                   # Test app helpers
├── jest-e2e.json              # E2E Jest config
└── setup-env.ts               # Test environment bootstrap
```

---

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
CORS_ALLOWED_HEADERS="Content-Type,Authorization,X-CSRF-Token"
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
# Generate three distinct values from at least 32 random bytes. Inject them at
# runtime through the deployment platform's secret manager; do not commit them
# or bake them into the container image.
# ============================================================

JWT_SECRET_KEY="__INJECT_JWT_SECRET_KEY_FROM_SECRET_MANAGER__"
REFRESH_SECRET_KEY="__INJECT_REFRESH_SECRET_KEY_FROM_SECRET_MANAGER__"
CRYPTO_SECRET="__INJECT_CRYPTO_SECRET_FROM_SECRET_MANAGER__"

JWT_EXPIRY_TIME="15m"
REFRESH_EXPIRY_TIME="7d"


# ============================================================
# Email / Postmark
# ============================================================

POSTMARK_SERVER_TOKEN="__INJECT_POSTMARK_SERVER_TOKEN_FROM_SECRET_MANAGER__"
POSTMARK_FROM_EMAIL="noreply@example.com"
POSTMARK_MESSAGE_STREAM="outbound"

# ============================================================
# Storage / Cloudflare R2
# ============================================================

STORAGE_DRIVER="local"
R2_ACCOUNT_ID="__INJECT_R2_ACCOUNT_ID_FROM_SECRET_MANAGER__"
R2_ENDPOINT="https://r2-account-id.r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID="__INJECT_R2_ACCESS_KEY_ID_FROM_SECRET_MANAGER__"
R2_SECRET_ACCESS_KEY="__INJECT_R2_SECRET_ACCESS_KEY_FROM_SECRET_MANAGER__"
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

---

## License

MIT License — free for personal and commercial use.

---

QuickAPI-NestJS — part of the **QuickAPI** template ecosystem by **John Desjardins**.
