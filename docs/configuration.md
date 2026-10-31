# Configuration

[Documentation index](../README.md#documentation)

## Sources and validation

[.env.example](../.env.example) documents host-development settings;
[.env.staging.example](../.env.staging.example) documents the staging contract.
[environment.schema.ts](../src/config/environment.schema.ts) defines accepted
values, defaults, and cross-field validation. Treat the schema and maintained
examples as the configuration reference rather than copying every default into
another table.

[Environment loading](../src/config/environment.config.ts) uses `.env.test` when
`NODE_ENV=test` is already set, otherwise `.env`; supplied process variables take
precedence over dotenv values. Validation runs before startup and invalid
configuration stops the process. Restart after changing environment settings.
Copying an updated example does not update an existing local `.env`.

## Host development

Follow [Setup](setup.md) for installation and startup commands. Never commit `.env`.

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

## Development, test, and staging targets

| Context          | Configuration                               | MySQL                      | Redis                                    |
| ---------------- | ------------------------------------------- | -------------------------- | ---------------------------------------- |
| Host development | `.env`, project `quickapi-nestjs-dev`       | localhost:3307, persistent | localhost:6379, persistent               |
| Local E2E        | `.env.test`, project `quickapi-nestjs-test` | 127.0.0.1:3308, disposable | 127.0.0.1:6380, authenticated/disposable |
| Staging          | Injected values and `.env.staging`          | Internal Compose service   | Internal Compose service                 |

Compose services reach dependencies by internal service name and port, not the
host-published development/test ports. Never copy development data-store targets
into test configuration. The [test bootstrap](../test/load-test-env.ts) selects
connections from `TEST_DB_*` and `TEST_REDIS_*` independently of ordinary
`DB_*`/`REDIS_*` values. See [test safety](testing.md#disposable-e2e-infrastructure).

Staging uses a secret-backed environment and the immutable image selected by
`QUICKAPI_IMAGE`. Run the staging preflight and Compose rendering checks described
in [Deployment](deployment.md#staging-compose-contract); these validate configuration,
not provider availability or a completed deployment.

## Settings by responsibility

| Settings                                                                                       | Responsibility and detailed contract                                                                                                |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `APP_*`, `NODE_ENV`, `PORT`, `LOG_LEVEL`                                                       | Runtime identity, execution mode, and logging                                                                                       |
| `PUBLIC_*`, `CORS_*`, `HTTPS_*`, `COOKIE_*`, `TRUST_PROXY`                                     | Browser transport and trusted ingress; see [Security](security.md#browser-and-proxy-boundaries)                                     |
| `DB_*`                                                                                         | Database identity, TLS, pool capacity, and connection budgets; use explicit migrations and keep production synchronization disabled |
| `REDIS_*`, throttle settings                                                                   | Shared queue/throttling dependencies; see [Security](security.md#rate-limiting)                                                     |
| Token secrets/expiry, refresh and CSRF cookie settings                                         | Authentication and cookie lifetimes; see [Security](security.md#identity-and-authorization)                                         |
| `DOCUMENTATION_ENABLED`, `METRICS_ENABLED`, `DETAILED_DIAGNOSTICS_ENABLED`, `OPERATIONS_TOKEN` | Independently controlled operational surfaces; see [Security](security.md#operational-access)                                       |
| `REQUEST_*`, `HEADER_*`, allowed method/content-type settings                                  | HTTP admission and deadlines; see [API contracts](api-contracts.md#request-deadlines)                                               |
| `STORAGE_*`, R2 settings, `UPLOAD_TMP_DIR`                                                     | Permanent R2 objects and temporary local uploads; see [Image processing](image-processing.md)                                       |
| Postmark, email, and GeoIP settings                                                            | Delivery and geolocation providers; see [Reliability](reliability.md) and [Setup](setup.md#geoip-and-runtime-files)                 |

Pool, worker, upload, and timeout limits must fit the resources and topology of the
actual deployment. Review the schema for exact units and accepted ranges. Do not
put production secrets in examples, test configuration, images, or browser bundles.
