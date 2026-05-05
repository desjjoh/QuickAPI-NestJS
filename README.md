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

## Environment Variables (`.env`)

```bash
APP_NAME=quickapi-nestjs
APP_URL=https://localhost:3000
APP_VERSION=1.0.1
WEB_URL=https://localhost:8080
NODE_ENV=development
PORT=8080
LOG_LEVEL=debug

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=root
DB_DATABASE=quickapi
DB_SYNC=false
DB_SEED=false

JWT_SECRET_KEY=replace-with-at-least-32-characters
REFRESH_SECRET_KEY=replace-with-at-least-32-characters
CRYPTO_SECRET=replace-with-at-least-32-characters
JWT_EXPIRY_TIME=15m
REFRESH_EXPIRY_TIME=7d

POSTMARK_SERVER_TOKEN=replace-with-postmark-token
POSTMARK_FROM_EMAIL=no-reply@example.com
POSTMARK_MESSAGE_STREAM=outbound
```

Each variable is validated at startup using Zod. The application exits early with formatted validation errors if the environment is incomplete or invalid.

> **Note:** `DB_SYNC` controls TypeORM schema synchronization. Keep this disabled for production-like environments and use migrations/schema-management workflows instead.

---

## Local HTTPS Certificates

The Nest application is currently configured to start with local HTTPS options and expects certificate files at:

```bash
certs/localhost-key.pem
certs/localhost.pem
```

For local development, generate trusted local certificates before running the server, or update the HTTPS options for your environment.

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

The Prometheus registry collects default Node.js metrics and custom HTTP request counters/duration histograms.

---

## Development Scripts

| Script                | Description                                       |
| --------------------- | ------------------------------------------------- |
| `npm run start`       | Start the Nest application through the Nest CLI   |
| `npm run start:dev`   | Start development server with watch mode          |
| `npm run start:debug` | Start development server with debugger/watch mode |
| `npm run build`       | Compile the Nest application to `dist/`           |
| `npm run start:prod`  | Start the compiled application from `dist/main`   |
| `npm run format`      | Format TypeScript sources using Prettier          |

---

## License

MIT License — free for personal and commercial use.

---

QuickAPI-NestJS — part of the **QuickAPI** template ecosystem by **John Desjardins**.
