# Deployment and operations

[Documentation index](../README.md#documentation)

The checked-in staging topology and release workflows define the deployment contract. Hosting, ingress, secrets and backup ownership remain environment-specific.

Recommended deployment contract:

- Build the Docker image from the repository.
- Inject secrets and environment variables through the hosting platform.
- Run all pending database migrations, then the reference-data seed command, before starting or replacing API instances. Serialize these jobs per database.
- Keep `DB_SYNC=false` in production.
- Use `STORAGE_DRIVER=r2` (the only supported provider, also the default) with all R2 credentials, bucket, endpoint, and public URL configured. Previous `local` settings must be updated; production rejects the shipped credential placeholders. Configuration validation does not verify provider connectivity or permissions—verify those against the actual R2 bucket before rollout.
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

## Staging Compose contract

Run the staging definition **by itself** after the deployment platform has
exported its configuration and secrets (for example, from a secret-manager
sidecar or CI secret context):

```bash
cp .env.staging.example .env.staging # then inject secrets and deployment values
npm run staging:preflight
docker compose --env-file .env.staging -f docker-compose.staging.yml config --quiet
docker compose --env-file .env.staging -f docker-compose.staging.yml run --rm migration
docker compose --env-file .env.staging -f docker-compose.staging.yml run --rm seed
docker compose --env-file .env.staging -f docker-compose.staging.yml up -d api
```

Use an immutable tag or digest for `QUICKAPI_IMAGE`. The compose file refuses to
render without database, Redis, token, operations, email, GeoIP, and object-store
credentials. It also requires the actual HTTPS `PUBLIC_API_URL`, HTTPS
`PUBLIC_WEB_URL`/`CORS_ORIGINS`, the external `INGRESS_NETWORK`, and a narrow
`TRUST_PROXY` ingress address or CIDR allowlist. Do not use localhost, example
domains, a wildcard CORS origin, or a trust-all proxy setting.

## Release images and supply-chain evidence

The runtime is a minimal Alpine image containing Node, compiled application code,
production dependencies, and required native libraries. Build and runtime stages
share `ALPINE_VERSION` to keep musl/native-module compatibility. npm, npx, Yarn,
and Corepack are build-time tools and are not copied into the deployed image.
Preflight, TypeORM migrations, reference-data seeding, and GeoIP initialization run directly with Node;
container overrides must not invoke `npm run`. Host-development npm scripts
remain available. Update the shared Alpine version deliberately and validate
native dependencies and the production topology together.

Base CI also runs a production dependency audit before release eligibility.
Unexcepted critical production advisories and missing/invalid audit evidence
block `Check` and `Staging deployment gate`; development-only findings are retained
separately, and high/lower production findings remain visible. The [dependency audit policy](../security/dependency-audit-exceptions.md)
defines exact scopes, ownership, justification, and expiry limited to 30 days.
This base-CI audit supplements the final-image gate below; it does not change the
release-image severity policy.

After the `CI` workflow succeeds on `main` or `staging`, the
`.github/workflows/release-image.yml` workflow builds and scans the production
candidate once, then publishes the approved manifest with the full commit SHA and `package.json` version
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
migration, seed, GeoLite initializer, preflight, and API services all pull that exact
digest; the staging Compose definition has no local build fallback.

The image carries OCI source, revision, version, and creation-time labels and a
BuildKit provenance/SBOM attestation. The workflow builds an unpublished single-platform OCI candidate once, scans its OS and Node packages, and blocks publication on every unexcepted critical finding (including unfixed findings), scanner failure, or incomplete evidence. HIGH and lower findings are retained for triage, not automatically blocked. Registry login and publication happen only after the shared gate passes. A build-time registry-copy helper imports the same OCI archive with attestations intact; archive/report/policy hashes are rechecked before publication and registry tag digests must match the approved candidate. No rebuild occurs between scan and publication.

Release/failure artifacts include the complete vulnerability JSON/SARIF, gate decision, scanner identity/version, candidate digest and archive hash, SPDX SBOM, provenance, and the exception register. Reports do not hide unfixed vulnerabilities. [The exception policy](../security/container-vulnerability-exceptions.md) requires exact vulnerability/package/version/path/target/type scopes, review ownership, and UTC expiry. The register starts empty; adding an exception requires explicit risk acceptance. A successful scan is release-time evidence, not a guarantee against future advisories. Recheck dependencies and base-image/tooling findings as advisories evolve.

`npm run release:check` builds and scans locally without registry credentials, publication, or GitHub runs. It requires Docker/buildx and downloads scanner/SBOM tooling containers; no app/npm dependency is added for scanning. CI additionally downloads the registry-copy helper. Local candidates, cache, and evidence are stored under ignored `.release-check/`; each temporary extracted layout is removed after scanning settles, including failures. Use Docker Desktop's modern image store or a buildx docker-container builder if your engine does not support the OCI exporter. CI remains responsible for registry authentication/permissions and tag-policy validation.

MySQL and Redis are attached only to the internal `private` network and have no
host-published ports. The API exposes port 4000 to its Docker networks but does
not publish it on the host. The ingress is the only public entry point: it must
terminate TLS, strip untrusted forwarding headers, connect through the named
external network, and proxy plain HTTP to port 4000. Consequently application
TLS is disabled while secure cookies remain enabled. The API health check probes
`/health`; configure the ingress/orchestrator readiness probe to use `/ready`.

The `preflight` service loads and validates `.env.staging` and must finish successfully before the migration or GeoLite jobs can run. The seed job waits for migrations; seeding and GeoLite initialization must finish before the API deployment. Targeted deployment automation must run `npm run staging:preflight` first as shown above.

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
`IP_LOCATION_DATA_DIR=/app/data/geoip` in `.env.staging`. Schedule updates according to the deployment owner’s freshness policy, then restart the API so its readers open the new files. A failed
download, archive extraction, or database validation exits nonzero and leaves
the last valid pair in place. The updater alone has read-write volume access;
the API keeps its mount read-only.

For local development, `npm run geoip:update` loads the repository `.env`
automatically. `MAXMIND_LICENSE_KEY` is required; `MAXMIND_ACCOUNT_ID` is
optional for the GeoLite download endpoint.

## Persistence, sizing, backups, and rollback

- `quickapi_mysql_data` is the authoritative relational-data volume;
  `quickapi_redis_data` retains queues and rate-limit state. `quickapi_uploads`
  mounts the public-assets directory; it is not an implemented local upload-storage driver. `quickapi_geoip` is populated by the GeoIP update
  job, and `quickapi_tmp` is scratch space and is not backed up. The storage provider currently binds R2 unconditionally; see [Known gaps](backlog.md). New durable email and storage jobs can be reconstructed from SQL, but legacy queue-only work cannot.
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
  maintenance window or deploy a forward-fix migration. A failed migration blocks rollout. Configure the hosting platform’s rollout policy to react to failed `/ready` probes; this repository does not implement deployment rollback automation. Do not delete or automatically roll back persistent volumes with the application.

## Observability and operations

Built-in operational endpoints include:

| Endpoint   | Purpose                                               |
| ---------- | ----------------------------------------------------- |
| `/health`  | Process liveness check                                |
| `/ready`   | Aggregate readiness result for platform probes        |
| `/info`    | Protected application/runtime metadata (opt-in)       |
| `/system`  | Protected runtime and dependency diagnostics (opt-in) |
| `/metrics` | Protected Prometheus-formatted metrics (opt-in)       |

`/health` and `/ready` remain unauthenticated for platform probes, but do not
return dependency identities or failure details. Outside development, set `METRICS_ENABLED=true` or
`DETAILED_DIAGNOSTICS_ENABLED=true` independently and send the non-user
deployment credential in `X-Operations-Key`. Disabled operational endpoints
return 404; missing or invalid credentials return 401. Swagger is only mounted
when `DOCUMENTATION_ENABLED=true`; `/docs` and `/docs-json` do not require an operations key. Keep documentation disabled or restrict it at ingress in deployed environments. Development diagnostics/metrics guards bypass enabled/key checks, so do not expose a development instance publicly.

The Prometheus registry collects default Node.js metrics and custom HTTP request counters/duration histograms when metrics are enabled.

No new periodic monitoring checks, alert routing, or support-ticket automation were added. Metrics expose HTTP and Node.js signals; they are not a backlog/expiry/contention monitoring system. Existing DLQ behavior is described in [Reliability](reliability.md). The deferred scope is tracked in [the backlog](backlog.md).

### Reference-data preparation

The production application image includes `dist/database/seed.js` and its seed catalogs. The one-shot `seed` service runs it directly with Node after migrations; it does not start HTTP, Redis clients, workers, or scheduled jobs. MySQL uses its standard image. API creation waits for successful seeding. For subsequent releases, explicitly rerun migrations and seeding using the new immutable image rather than relying on an old completed Compose container.

A seed failure blocks rollout and rolls back all seed groups. Fix the underlying error and rerun the same command; do not delete database volumes. Existing reference records are preserved, except that missing baseline role permissions are restored. Review authorization catalog changes accordingly. See [development](development.md) for repeat-run behavior.
