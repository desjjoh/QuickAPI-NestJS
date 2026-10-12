# Technical backlog and verified gaps

[Documentation index](../README.md#documentation)

This is an engineering follow-up list, not a claim that every item blocks every deployment. Entries distinguish observed implementation gaps from intentionally deferred capabilities. Prioritize against the actual rollout environment and risk.

## Verified implementation gaps

| Item                     | Evidence and impact                                                                                                                                                                                       | Follow-up                                                                                                                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Release scan enforcement | [release-image.yml](../.github/workflows/release-image.yml) reports Trivy findings using `--exit-code 0` and `--ignore-unfixed`; images are pushed before scan results.                                   | Agree on a severity/exception policy, decide whether to block publication or deployment, and implement an enforced gate. Do not describe current scans as blocking critical findings.                         |
| Legacy email privacy     | Legacy compiled-payload jobs remain supported; the generic failure/DLQ path can retain original payloads and failure details. New outbox jobs use identifier-only payloads and sanitized delivery errors. | Drain legacy work, remove compatibility when safe, sanitize/redact retained failure metadata, and include Redis/DLQ backups in erasure policy. Never include raw email/challenge contents in tickets or logs. |

## Deliberately deferred

- Deployment access policy for enabled Swagger: `/docs` and `/docs-json` are not protected by the operations-key guards. Keep them disabled or restrict access at ingress; do not assume the metrics/diagnostics credential also protects documentation.
- Operational backlog/expiry/failure/contention checks and alert delivery. The decision was to skip new automated monitoring actions; existing logs and opt-in HTTP/Node metrics remain.
- Standardized DLQ events, support-ticket creation/linkage, and authorized operator retry workflows. Current terminal cleanup failures cannot be revived by simply retrying a Bull job.
- Provider/bucket-wide reconciliation for old or externally created objects outside the tracked upload registry. Current reconciliation covers tracked uploads and late writes to never-reused keys.
- User pagination optimization. Article list hydration is lean; review user queries separately with representative data before changing them.
- Full-text/dedicated article search once measured volume warrants it. Preserve authoritative visibility restrictions independently of the search engine.
- Retention/purge policy for storage tombstones and terminal failure records. Do not remove ownership fences without proving late-write/reference safety.

## Environment-owned release evidence

Before calling a particular deployment production-ready, verify real-provider credentials and behavior, ingress/proxy/CORS/cookies, backup restore, object/database consistency, pool/worker sizing, and outage recovery. CI uses disposable infrastructure and mocked delivery/storage boundaries; it does not prove these environment-specific conditions.

A green CI run is required evidence, not a substitute for a restore drill or an owner for failures. Record that evidence with the release rather than embedding temporary pass counts in the README.
