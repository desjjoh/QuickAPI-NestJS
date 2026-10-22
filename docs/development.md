# Development

[Documentation index](../README.md#documentation)

## Local configuration

Install Node.js 22 and Docker/Compose v2, run `npm ci`, then copy [.env.example](../.env.example) to `.env` (`Copy-Item .env.example .env` in PowerShell). Never commit this file.

The example is a configuration reference, not a ready-to-deploy file. For local work:

- Set `NODE_ENV=development` and a useful `LOG_LEVEL` rather than the sample test/silent values.
- Generate three distinct secrets for `JWT_SECRET_KEY`, `REFRESH_SECRET_KEY`, and `CRYPTO_SECRET`. Run the following command separately for each, then place the result only in your secret configuration:

  ```bash
  node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
  ```

- With `HTTPS_ENABLED=false`, use matching HTTP public API/web URLs and CORS origins. Default local API port is 4000.
- Keep `Idempotency-Key` in `CORS_ALLOWED_HEADERS` alongside `Content-Type`, `Authorization`, and `X-CSRF-Token`. Existing `.env` files are not updated when examples change. Restart the API after editing environment values; a browser preflight rejecting this header prevents the actual mutation from reaching the controller.
- The development MySQL service uses host port 3307 and the disposable development credentials in the example. Keep `DB_SYNC=false`.
- Development Redis uses host port 6379 without authentication. Leave `REDIS_PASSWORD` empty for that topology only; deployed Redis must use its configured credentials.
- Swagger is opt-in but is not operations-key protected; restrict it at ingress outside development. Metrics and diagnostics use an operations credential outside development; development guards bypass the flag/key checks. Do not reuse an end-user token for operations access.
- Email is disabled by default. Enable Postmark only with a valid token and sender; use fake providers in tests.
- **Cloudflare R2 is the only supported storage provider.** `STORAGE_DRIVER` accepts only `r2` and defaults to it when omitted. All six R2 settings are required at startup in every environment. Replace reference placeholders with valid credentials/URLs before using uploads; unsupported drivers and missing/blank settings are rejected. Permanent uploads live in R2, while `UPLOAD_TMP_DIR` is scratch space and `public/` serves static assets.
- Set a MaxMind license key and initialize both GeoLite2 databases before starting the app.

For app-owned local TLS, create certificates and configure `HTTPS_KEY_PATH`/`HTTPS_CERT_PATH`, HTTPS URLs, and cookie settings consistently. Reverse-proxy TLS termination instead uses HTTP inside the trusted network; see [deployment](deployment.md).

## Start dependencies and application

```bash
npm run docker:mysql:up
npm run docker:redis:up
npm run migration:run
npm run geoip:update
npm run start:dev
```

Wait for MySQL to become healthy before running migrations. Docker service names resolve inside Compose; a host-run application uses the published localhost ports.

The API never runs migrations automatically. Set `DB_SEED=true` for initial application startup to populate required library, authorization, and article-status records, then disable it. Review seeders before using startup seeding on a deployed database; seeding is not a migration or deployment strategy.

`npm run docker:redis:down` stops Redis without deleting its volume. `docker:status` shows services. `docker:api:up` runs the containerized API, whose production configuration has stricter validation; disable Bull Board and supply valid deployment values before using that alternative. The host-run development flow above is simpler for code iteration.

## Database changes

```bash
npm run migration:show
npm run migration:generate
npm run migration:run
```

Review generated SQL before applying it. Use `migration:create` for a hand-written migration, and `migration:revert` only against a known disposable database or a reviewed recovery plan. Reverts can destroy data and MySQL DDL is not fully transactional.

Production uses `migration:run:prod` against the compiled datasource. Apply all pending migrations rather than naming historical files in tests or deployment instructions. Check entity metadata, migration discovery, forward/revert compatibility, and foreign-key supporting indexes together.

## GeoIP and runtime files

`geoip:update` downloads and validates Country and City databases under `IP_LOCATION_DATA_DIR`. Local downloads require `MAXMIND_LICENSE_KEY`; `MAXMIND_ACCOUNT_ID` is optional for that endpoint. A failed update preserves the last valid pair. Restart the API after updating: readers do not automatically reopen files.

`UPLOAD_TMP_DIR` is scratch space for multipart files, not permanent object storage. Uploaded media lives in R2. Static `public/` assets and GeoIP data are separate concerns; mounting `public/` does not implement local upload storage.

## Checks and command reference

### Readability conventions

Prettier owns indentation, wrapping, quotes, and trailing commas. Source-code
lint rules additionally separate class methods and logical statement groups:
leave a blank line after declarations before executable work, after block-like
steps, and before returns/throws. Related declarations and class data fields may
remain grouped. Historical database migrations are excluded from the additional
spacing rules; do not churn historical SQL for formatting.

Use `npm run lint:fix` and `npm run format` for TypeScript cleanup. Keep changes
behavior-preserving: do not reorder side effects or rewrite conditions merely to
improve spacing. Add comments for intent and invariants (transaction ownership,
concurrency fences, retry safety, validation boundaries, and non-obvious limits),
not a line-by-line narration. Update comments when their assumptions change.
Keep the README short and link to focused guides for implementation contracts.

### Verification

Use `npm run check` for formatting, lint, type checking, unit/in-process integration tests, and build; use `test:cov` for coverage gates. See [Testing](../test/TESTING.md) before starting E2E or smoke tests.

Application and test code use TypeScript `strict` mode and reject switch fallthrough. The build and E2E configurations inherit these protections from the root configuration. `npm run typecheck` checks both the main NodeNext configuration and the E2E bundler configuration; CI runs this same command. The individual commands are `typecheck:main` and `typecheck:e2e`. Dependency declaration checking remains skipped with `skipLibCheck`; application/test checking is not weakened.

[package.json](../package.json) defines available commands. The convenience E2E scripts use POSIX environment assignment; PowerShell users should follow the explicit Windows instructions in the testing guide.
