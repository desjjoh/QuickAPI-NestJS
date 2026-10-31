# Technical backlog and verified gaps

[Documentation index](../README.md#documentation)

This is an engineering follow-up list, not a claim that every item blocks every deployment. Entries distinguish observed implementation gaps from intentionally deferred capabilities. Prioritize against the actual rollout environment and risk.

## Verified implementation gaps

Production image scans cover the final OS and application dependency tree, not
just the application's lockfile. Runtime package managers are intentionally
excluded; npm remains in build stages only. Continue triaging future Node,
Alpine, native-library, and application findings against the exact candidate.
A clean `npm audit --omit=dev` is not proof that the entire image has no findings.
The maintained exception registers record any approved risk acceptance; see [Security](security.md#dependency-and-image-security).

| Item                             | Evidence and impact                                                                                                                                                                                                                                                                     | Follow-up                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production dependency advisories | On 2026-10-24, the dependency audit at baseline `c2446ee` reported high advisories in `body-parser@2.3.0`, `multer@2.4.0`, and `zod@4.1.12`; `@nestjs/platform-express` is also flagged through its dependency chain. `fast-uri@3.1.8` is a separate moderate development-only finding. | Review compatible updates and rerun dependency audits, relevant application regressions, and final-image checks. High/lower findings remain nonblocking under the critical-only policy. Do not create exceptions merely to make CI green. See the [dependency audit policy](../security/dependency-audit-exceptions.md); reports are time-specific. |
| Base-CI runtime image security   | Final-image scanning currently runs in the release workflow. Express now runs a critical-only scan of the immutable runtime image already used by PR/branch smoke tests.                                                                                                                | Add the same OS/Node image scan to base CI, retain every severity and failure report, enforce exact expiring exceptions, and require it in both aggregate gates. Keep release-time revalidation of the actual published candidate.                                                                                                                  |
| Legacy email privacy             | Legacy compiled-payload jobs remain supported; the generic failure/DLQ path can retain original payloads and failure details. New outbox jobs use identifier-only payloads and sanitized delivery errors.                                                                               | Drain legacy work, remove compatibility when safe, sanitize/redact retained failure metadata, and include Redis/DLQ backups in erasure policy. Never include raw email/challenge contents in tickets or logs.                                                                                                                                       |

## Intermittent production-image shutdown timeout

The local production-image smoke test (`.github/scripts/ci-smoke.sh`) intermittently exceeded its 25-second final shutdown wait after sending `SIGTERM` to the API container, returning exit code `124`. The captured API log confirms receipt of `SIGTERM`, but does not establish which cleanup operation remained pending.

Migration, explicit seeding, repeated seeding, seed-failure exit codes, and API readiness checks passed before the timeout. A separate uninstrumented smoke run and a diagnostic run tracing Nest shutdown hooks completed successfully. The full E2E suite also passed. These passing runs do not resolve the intermittent failure, and there is no confirmed link to the seeding changes or to the separate Windows launcher termination issue.

Follow up by reproducing the timeout while retaining per-hook shutdown timings, container state, and database/Redis connectivity evidence. Identify the pending operation and verify cleanup completion before changing shutdown behavior or the deadline. Keep the existing timeout and failure check intact; do not treat receipt of a shutdown signal as successful cleanup. The smoke test checks shutdown before reverting the database baseline, so workers are stopped before schema teardown. That ordering change alone does not establish the cause of the earlier intermittent timeout.

## Deliberately deferred

- Deployment access policy for enabled Swagger: `/docs` and `/docs-json` are not protected by the operations-key guards. Keep them disabled or restrict access at ingress; do not assume the metrics/diagnostics credential also protects documentation.
- Operational backlog/expiry/failure/contention checks and alert delivery. The decision was to skip new automated monitoring actions; existing logs and opt-in HTTP/Node metrics remain.
- Standardized DLQ events, support-ticket creation/linkage, and authorized operator retry workflows. Current terminal cleanup failures cannot be revived by simply retrying a Bull job.
- Provider/bucket-wide reconciliation for old or externally created objects outside the tracked upload registry. Current reconciliation covers tracked uploads and late writes to never-reused keys.
- User pagination optimization. Review user queries with representative data before changing them.
- Retention/purge policy for storage tombstones and terminal failure records. Do not remove ownership fences without proving late-write/reference safety.

## Environment-owned release evidence

Before calling a particular deployment production-ready, verify real-provider credentials and behavior, ingress/proxy/CORS/cookies, backup restore, object/database consistency, pool/worker sizing, and outage recovery. CI uses disposable infrastructure and mocked delivery/storage boundaries; it does not prove these environment-specific conditions.

A green CI run is required evidence, not a substitute for a restore drill or an owner for failures. Record that evidence with the release rather than embedding temporary pass counts in the README.
