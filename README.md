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
- **Library/reference-data seeders** for countries, genders, permissions, and roles
- **Email module** powered by Postmark with typed template support
- **Profile image upload support** with validation, disk storage, and image metadata handling
- **Graceful lifecycle orchestration** through a shared lifecycle handler
- **Docker Compose local infrastructure** with MySQL and API services
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
│   │   └── library/           # Countries, genders, roles, permissions, images, repositories, seeders
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
/ready                    # Readiness check with database status
/info                     # Runtime metadata
/system                   # System diagnostics
/metrics                  # Prometheus metrics
/docs                     # Swagger UI
/docs-json                # OpenAPI JSON

/api/v1/security          # CSRF and browser request-security endpoints
/api/v1/authentication    # Registration, sign-in, sign-out, refresh
/api/v1/account           # Current-user account and profile management
/api/v1/administration    # Admin/platform user-management endpoints
/api/v1/library           # Countries, genders, roles, permissions, and reference data
```

Swagger UI is available at:

```bash
https://localhost:8080/docs
```

OpenAPI JSON is available at:

```bash
https://localhost:8080/docs-json
```

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
APP_NAME="quickapi-nestjs"
APP_VERSION="1.0.0"
PUBLIC_API_URL="http://localhost:4000"

NODE_ENV="development"
PORT="4000"
LOG_LEVEL="info"

CORS_ORIGINS="http://localhost:5173"
CORS_METHODS="GET,POST,PUT,PATCH,DELETE"
CORS_ALLOWED_HEADERS="Content-Type,Authorization,X-CSRF-Token"
CORS_EXPOSED_HEADERS="Authorization,Set-Cookie"
CORS_CREDENTIALS="true"
CORS_MAX_AGE_SECONDS="86400"

HTTPS_ENABLED="false"
HTTPS_KEY_PATH="certs/localhost-key.pem"
HTTPS_CERT_PATH="certs/localhost.pem"

COOKIE_SECURE="false"
COOKIE_SAME_SITE="strict"
COOKIE_PATH="/"
COOKIE_DOMAIN=""

REFRESH_COOKIE_NAME="refresh_token"
REFRESH_COOKIE_MAX_AGE_DAYS="7"

CSRF_COOKIE_NAME="csrf_token"
CSRF_COOKIE_MAX_AGE_MINUTES="15"

STATIC_SERVE_ENABLED="false"
STATIC_ROOT_PATH="public"
STATIC_SERVE_ROOT="/"

UPLOAD_TMP_DIR="tmp"

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

JWT_SECRET_KEY="replace-with-at-least-32-characters"
REFRESH_SECRET_KEY="replace-with-at-least-32-characters"
CRYPTO_SECRET="replace-with-at-least-32-characters"

JWT_EXPIRY_TIME="15m"
REFRESH_EXPIRY_TIME="7d"

POSTMARK_SERVER_TOKEN="replace-with-postmark-token"
POSTMARK_FROM_EMAIL="noreply@example.com"
POSTMARK_MESSAGE_STREAM="outbound"
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

The local Docker setup provides MySQL and an optional API container.

Start MySQL:

```bash
npm run docker:mysql:up
npm run docker:status
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

- Countries
- Genders
- Permissions
- Roles

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

## Observability & Operations

Built-in operational endpoints include:

| Endpoint   | Purpose                                                                 |
| ---------- | ----------------------------------------------------------------------- |
| `/health`  | Process liveness check                                                  |
| `/ready`   | Readiness check including database connectivity                         |
| `/info`    | Application name, version, environment, host, and PID                   |
| `/system`  | Runtime diagnostics such as uptime, event loop lag, and database status |
| `/metrics` | Prometheus-formatted metrics                                            |

## The Prometheus registry collects default Node.js metrics and custom HTTP request counters/duration histograms.

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

Run the full local check:

```bash
npm run check:full
```

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

| Script                     | Description                                       |
| -------------------------- | ------------------------------------------------- |
| `npm run start`            | Start the Nest application through the Nest CLI   |
| `npm run start:dev`        | Start development server with watch mode          |
| `npm run start:debug`      | Start development server with debugger/watch mode |
| `npm run build`            | Compile the Nest application to `dist/`           |
| `npm run start:prod`       | Start the compiled application from `dist/main`   |
| `npm run format`           | Format TypeScript sources using Prettier          |
| `npm run format:check`     | Check formatting without writing changes          |
| `npm run lint`             | Run ESLint                                        |
| `npm run lint:fix`         | Run ESLint with auto-fix                          |
| `npm run typecheck`        | Run TypeScript without emitting files             |
| `npm test`                 | Run unit tests                                    |
| `npm run test:e2e`         | Run E2E tests                                     |
| `npm run check`            | Run baseline local quality gate                   |
| `npm run check:e2e`        | Run E2E checks                                    |
| `npm run check:full`       | Run baseline quality gate and E2E checks          |
| `npm run migration:show`   | Show TypeORM migration status                     |
| `npm run migration:run`    | Run pending TypeORM migrations                    |
| `npm run migration:revert` | Revert the latest TypeORM migration               |
| `npm run docker:build`     | Build the production Docker image                 |
| `npm run docker:mysql:up`  | Start local Docker MySQL                          |
| `npm run docker:api:up`    | Start the API container                           |
| `npm run docker:status`    | Show Docker Compose service status                |

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
- Use `/metrics` for Prometheus scraping.
- Do not bake `.env`, certificates, runtime uploads, or local temp files into the image.

---

## License

MIT License — free for personal and commercial use.

---

QuickAPI-NestJS — part of the **QuickAPI** template ecosystem by **John Desjardins**.
