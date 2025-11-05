# 🧭 QuickAPI Suite — A Curriculum for Backend Craftsmanship

## Purpose

The **QuickAPI Suite** is not a collection of templates — it’s a **progressive learning ecosystem**.  
Each project teaches a different stage of backend development maturity, showing how the same design principles translate across frameworks and languages.

You can think of it as a _curriculum_:

| Project              | Stack                          | Purpose                                                                                  |
| -------------------- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| **QuickAPI-FastAPI** | Python + FastAPI + Pydantic    | Async REST microservice for rapid API prototyping and async I/O performance.             |
| **QuickAPI-Express** | TypeScript + Express + Zod     | Minimal Node.js API focusing on clarity, middleware flow, and validation fundamentals.   |
| **QuickAPI-NestJS**  | TypeScript + NestJS + TypeORM  | Enterprise-grade Node.js application with modular architecture and dependency injection. |
| **QuickAPI-DotNet**  | C# + ASP.NET Core Minimal API  | Enterprise/government backend emphasizing static typing and structured controllers.      |
| **QuickAPI-Django**  | Python + Django REST Framework | ORM-heavy monolith showcasing robust relational modeling and built-in admin tools.       |
| **QuickAPI-Rust**    | Rust + Axum or Actix-Web       | High-performance systems API demonstrating safety, concurrency, and low-level control.   |
| **QuickAPI-Spring**  | Java + Spring Boot 3           | Enterprise-grade Java API illustrating dependency injection and mature ecosystem design. |
| **QuickAPI-Ruby**    | Ruby + Sinatra / Rails         | Convention-over-configuration demo focusing on developer experience and rapid iteration. |

---

## 🎓 Design Philosophy

> _“Every line of verbosity teaches correctness.”_

These projects are intentionally explicit. They’re not built to impress — they’re built to explain.  
Each one shows that professional engineering isn’t about hidden magic, but about **clarity, predictability, and structure**.

Core tenets that unify the suite:

1. **Fail fast.**  
   Validation and configuration happen before the app even starts.
2. **Observe everything.**  
   Structured logs, graceful shutdowns, and runtime transparency are non-negotiable.
3. **Build around truth.**  
   Data validation, DTOs, and schemas ensure the system’s state is always trusted.
4. **Teach by doing.**  
   Every decorator, docstring, and comment exists to show _why_ — not just _how_.

---

## 🧱 Project Build Steps Template (Cross-Framework Standard)

**Step 1 — Boilerplate Setup**  
Establish a clean, modular project structure with a single entrypoint.  
Use the framework’s native bootstrap mechanism to initialize configuration, logging, and routing layers in isolation.  
Every service should start with a verifiable health route and emit a startup log with context.

> **Standard:** No implicit framework magic. Startup logic must be explicit, logged, and observable.

---

**Step 2 — Environment & Configuration**  
Load environment variables at startup, validate them using a typed schema (Zod, Pydantic, or equivalent), and expose configuration through a strongly typed service or singleton.  
Invalid or missing values must terminate the process before any HTTP server binds to a port.

> **Standard:** Configuration must be _type-safe_, _validated at runtime_, and _immutable at runtime_.

---

**Step 3 — Logging**  
Integrate a structured logger (Pino, Winston, Loguru, etc.) that supports both human-readable and JSON output.  
Log levels must follow `error > warn > info > debug > trace`.  
Include timestamps, context, and correlation IDs in every log entry.

> **Standard:** Logs must be machine-parsable, colorized in development, and consistent across services.

---

**Step 4 — Error Handling**  
Implement centralized exception handling (middleware, filter, or decorator) that converts framework errors into a unified JSON structure.  
Every error response should contain:  
`timestamp`, `statusCode`, `message`, `path`, and (optional) `traceId`.

> **Standard:** No unformatted stack traces should reach clients; logs capture full context instead.

---

**Step 5 — Validation**  
Apply declarative validation to all incoming payloads using DTOs or schema objects.  
Transform and sanitize inputs before persistence.  
Generate or export schema definitions (e.g., OpenAPI) automatically.

> **Standard:** Request data is never trusted; validation is mandatory for every endpoint.

---

**Step 6 — Database Integration**  
Abstract persistence through an ORM or query builder (TypeORM, SQLAlchemy, Prisma, etc.).  
Use a dedicated configuration factory to connect using validated credentials.  
Define entities/models with creation and update timestamps, typed relations, and migrations for schema evolution.

> **Standard:** Database config lives in code, not in ad-hoc environment variables.

---

**Step 7 — Security & Stability**  
Enable Helmet (or framework equivalent), CORS, and compression by default.  
Apply rate-limiting, request size limits, and input sanitization.  
Graceful shutdown must close servers and database pools cleanly.

> **Standard:** Services must tolerate termination signals and exit without orphaned connections.

---

**Step 8 — Health & Metrics**  
Expose `/health` for readiness and `/metrics` for Prometheus or compatible collectors.  
Include uptime, environment, DB connectivity, and resource usage.  
Startup and shutdown durations must be logged.

> **Standard:** Every service must self-report operational health without external inspection.

---

**Step 9 — Docker & Deploy**  
Provide a multi-stage Dockerfile that builds cleanly and runs unprivileged.  
Include a `docker-compose.yml` for local stack orchestration (API + DB).  
Ship `.env.example` and `.dockerignore` to keep reproducible environments.

> **Standard:** A fresh clone must run locally with one command — no manual setup.

---

**Step 10 — Observability, Refinement & Documentation**  
Add correlation IDs, request duration tracking, and optional distributed tracing (OpenTelemetry).  
Document configuration, routes, logging conventions, and deployment steps in-repo.  
Every public endpoint must appear in an autogenerated OpenAPI/Swagger spec.

> **Standard:** Transparency is mandatory — systems should explain themselves through docs and logs.

---

## 🧭 Future Vision

The QuickAPI Suite will expand to demonstrate interoperability between languages and platforms:

- Shared schema validation via OpenAPI parity.
- Unified observability stack.
- Service orchestration under a single gateway.

Ultimately, the suite is a teaching tool — one that proves **clarity scales better than cleverness**.
