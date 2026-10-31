# API contracts

[Documentation index](../README.md#documentation)

Enabled Swagger is the endpoint/schema reference. This guide records cross-request guarantees clients must understand.

## Avatar uploads

`POST /api/v1/account/profile/avatar` still accepts PNG, JPEG, and GIF uploads
within the existing byte and pixel limits. New uploads and replacements are
auto-oriented, center-cropped without stretching, and resized to exactly 256×256
(including enlargement). Only the resulting static WebP is stored, with
transparency preserved and actual output metadata. Animated GIFs use their first
frame; APNG is unsupported. Existing avatars are not rewritten. Request/response shapes and existing transactional
avatar audits, idempotency, and cleanup contracts are unchanged; processing does
not produce an additional audit event.

## Account deletion and historical identity

Self-service and administrator deletion preserve the original user/profile IDs and set the account status to `deleted`. This status is the authoritative deletion state: neither display names nor `metadata.deleted_at` determine whether an account is deleted. The entity stores the nullable timestamp in metadata and exposes it in user responses as `metadata.deletedAt` (ISO 8601).

Names, birth date, bio, regional references, and historical metadata are retained. Audit references continue to identify the original user. The email is replaced by a unique random internal address under `users.invalid`, freeing the original email for a new account with a different user ID. Passwords, sessions, account challenges, MFA settings, registration records for the current email, roles, phone numbers, and mailing addresses are removed. Avatars are detached and their image records removed; durable storage cleanup rechecks references and retries provider failures after commit. Normal user lists and ID/phone lookups exclude deleted accounts; email lookup no longer finds a deleted account by its original email. Deleted accounts cannot authenticate or be reactivated through administration.

Soft deletion, avatar cleanup intent, and the success audit share a transaction. Pending durable email intents matching the user or current email are cancelled and their encrypted bodies removed. Provider delivery already in flight cannot be recalled. Legacy payload-bearing BullMQ jobs are not covered by this cancellation; drain them before rollout as described in the technical backlog.

Cached idempotency responses owned by, or directly representing, the user are erased without removing the duplicate-execution fence. An identical retry of an erased response returns `409` and does not execute again. Administrator deletion retries retain their original bodyless `204`. This is a historical-retention policy, not anonymization or comprehensive privacy erasure. Access to retained personal data and any future erasure policy must be managed separately. Audits, logs, backups, and already-delivered emails have separate retention policies; this does not guarantee that they contain the original email or that it has been erased everywhere.

The baseline schema contains deletion metadata, and reference seeding supplies the dedicated deleted account status. Account deletion preserves identity records; reverting the baseline destroys the entire schema and is only appropriate for disposable databases.

## Identity and authentication audit snapshots

Audit classifications (`actor_type`, `source`, `domain`, `subject_type`, and `resource_type`) are database enums matching the controlled application catalogs. Subject/resource types remain nullable. Event names and historical identifiers remain strings; emitted events must still use a valid namespaced name matching their domain. Adding a classification requires both an application catalog change and a migration; retain enum values needed by historical records even when they are no longer emitted. MySQL strict SQL mode is required for invalid enum values to fail rather than coerce to an empty enum value.

The baseline creates the controlled classifications as database enums. Future catalog changes require a reviewed forward migration that preserves values needed by retained historical records. Migration catalogs are frozen independently of evolving application constants.

Administration audit search, detail, and user-activity responses include a nullable `actorUser` using the shared audit user display model: `id`, `name`, `email`, a minimal avatar (`id`/`url`), and `status` (`key`/`label`). This is current display information, not the actor's identity or permissions at event time. Tombstoned actors retain their ID and name with `status.key = deleted`, their current internal UUID email (`deleted-<uuid>@users.invalid`), and `avatar = null`; the original email is not exposed and deletion state is never inferred from a name or email. Other personal/security fields and internal avatar storage details are not exposed. Existing audit permissions govern this administration-only display information; historical snapshot emails remain redacted.

Audits retain the historical `actorType`/`actorId` independently of a nullable, non-eager foreign-key relationship to the initiating user. User/admin actors link when the user exists; anonymous/service/system actors do not. Tombstoning preserves the link; physical deletion sets only the relationship to null and never deletes the audit or historical actor ID. Display data is explicitly batch-loaded for the requested administration page after audit pagination, without eager user relations or per-event user queries. Missing historical users are not reconstructed automatically.

Self-service and administrator deletion capture the fresh row under a write lock, reload the persisted tombstone, and insert the audit in the same transaction as deletion and avatar cleanup intent. These deletion events retain complete policy-redacted before/after context plus a separate diff, including stable user/profile IDs, names, administration revision, status, deletion timestamp, and avatar ID/removal. Audit failure rolls back the mutation; completed administrator idempotency retries replay without another audit event.

Email values remain `[CHANGED]`; the diff indicates an email change without retaining either address. Passwords/hashes, OTPs, tokens, cookies, and MFA secrets are never persisted in audit snapshots. Explicitly type-checked security timestamps and MFA-enabled booleans are safe audit state, not secrets. Other mutation events retain changed fields rather than complete snapshots. Unchanged safe state is not a fabricated change: meaningful security events can still be recorded with an empty diff when timestamps collide. Password-reset requests are semantic events, not a fictitious persisted user flag.

Security routes use the shared request transaction and root-user lock. Authentication, account-security, registration, and session audits reload the relevant state at the mutation boundary rather than diffing stale guard objects or intended outcomes. Registration snapshots are taken after session issuance/sign-in metadata; revoked sessions are reloaded including their inactive state. Invalid OTP-attempt accounting keeps its existing independent persistence behavior. Historical audit rows are not backfilled; names and stable subject IDs remain available after deletion, but original emails cannot be recovered from these redacted audit records.

## Request idempotency

Audit events emitted while an accepted keyed operation executes retain the original client key in nullable `idempotency_key`, exposed as `idempotencyKey` in audit responses. Requests without a key and historical events use null; keys are not reconstructed from request IDs. Completed retries do not create another mutation audit. Keys are correlation identifiers, not globally unique audit IDs: interpret them alongside actor, route, event, and time. Use opaque random keys, never credentials or personal data. Audit retention/access rules apply independently of the 24-hour response replay retention. The baseline includes this nullable audit column.

Account profile avatar/phone/address creation, replacement, and removal accept an optional `Idempotency-Key`. The profile routes are `POST` and `DELETE /api/v1/account/profile/{avatar,phone,address}`. Generate a fresh key for each intended action, then keep the same key and payload (including `expected_version` where required and identical image bytes/client filename) for network retries. Keys must contain 1–128 printable, non-whitespace ASCII characters and no commas. Requests without a key retain their existing behavior. Profile POST responses remain `201`, and profile DELETE responses remain `200`; other opted-in operations returning `204` replay without a response body.

Keys are scoped to the authenticated actor, operation, and HTTP method/resource path. For 24 hours, identical retries return the original JSON body and HTTP status, even if the resource has since changed. Replaying a profile delete does not delete a subsequently recreated avatar or contact. A replayed profile response is a historical snapshot, not current profile/session/permission state; fetch the current account when that distinction matters. A different payload using the same key returns `409 Conflict`; an overlapping request also returns `409` and can be retried with backoff after the first finishes. Authentication, permissions, CSRF protection, and rate limits still apply to retries. Validation and transaction failures roll back the claim so the action can be retried safely.

The reusable `Idempotent` decorator/interceptor and system idempotency service own this concern; controllers only opt in. When adding another operation, import `IdempotencyModule`, apply the decorator above any multipart interceptor, and use `runInTransaction` for all database mutations so they share the request transaction and lifecycle. Explicitly pass that transaction manager to downstream writes and audit calls. Identity and audit services resolve their default managers through `applicationManager`, so they also join the active application transaction; other services must explicitly opt in or receive the manager. Nontransactional external effects still need lifecycle compensation or an outbox; this is not a general guarantee of exactly-once delivery to external systems. This decorator is not suitable unchanged for anonymous authentication or token/cookie-issuing flows.

The MySQL implementation uses non-waiting connection-scoped advisory locks across API replicas and commits the action, audit events, and replay record together. Replay eligibility expires after 24 hours and retries do not extend expiry. Expired rows are swept hourly while the application is running, so physical removal can lag expiry; backups have their own retention. After expiry a reused key is a new action. Existing browser deployments must add `Idempotency-Key` to `CORS_ALLOWED_HEADERS`.

Profile response snapshots include personal information (email, date of birth, contacts, and display/session metadata) already present in `UserDto`. They do not contain password hashes or access/refresh tokens. The store persists a request fingerprint, not the request payload or uploaded bytes, and hashes the raw client key into the scope identifier. Restrict table/backup access as for identity data, encrypt database storage and backups operationally, and include snapshots in retention/erasure procedures. Expiry is not immediate account-erasure cleanup. Never opt credential/token responses into this full-response store without a separate security and replay policy.

Administrator user mutations also accept `Idempotency-Key`: `PATCH /api/v1/administration/users/:id` replays the original `200` user representation, and `POST /api/v1/administration/users/:id/delete` replays bodyless `204` after the target has been deleted. The key includes the administrator and target route; a changed reason/status/role payload conflicts. Update/deletion, the success audit, and the replay record commit together; avatar storage deletion is scheduled transactionally and executed asynchronously after commit. Current authentication and endpoint permissions are checked on every retry. If the administrator deletes their own account or loses the required permission, replay does not bypass that loss of access.

Administration user list/detail/update responses include `version`, backed by `users.administration_version`. `PATCH /api/v1/administration/users/:id` and `POST /api/v1/administration/users/:id/delete` require a numeric `expected_version` and a controlled `reason_code`. This is a breaking request-contract change: missing/invalid revisions fail validation with `422`; stale revisions return `409` before mutation, audit or storage cleanup. Reload and reconcile the user before sending a new action. Successful updates advance the revision exactly once, including accepted no-op actions, and revision changes roll back with failed mutations/audits. Delete compares the current revision under the existing row lock before cleanup. The revision tracks status/role administration, including other application status/role writes through the shared user service; profile edits and sign-in activity do not advance it. Ordinary account/authentication responses remain unchanged. Shared user writes cannot restore an old revision or save unrelated stale root status/role fields.

The baseline initializes administration revisions at 1. Apply all pending migrations before deploying. An identical completed keyed retry still replays the historical response (including its historical version) without checking that old revision against current state. Changed payloads, including a changed expected_version under a completed key, conflict. A failed stale action leaves no replay claim, so a corrected request can retry; current authentication and permissions still apply. Idempotency keys/request IDs are not substitutes for version checks. Administrator replay snapshots retain personal information under the retention/access policy above. Deployment rollback must coordinate client contracts and older writer processes: old versions that do not maintain administration revisions cannot safely coexist with the new concurrency contract.

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

## Error responses and correlation

Unexpected failures return `500` with `message: "Internal server error"` and a
server-generated `requestId`. The same ID appears in `X-Request-ID` and sanitized
diagnostics. Client-supplied request IDs are not trusted or echoed as correlation
IDs. Known validation, authentication, authorization, conflict and timeout errors
retain their existing status/message; ordinary client-error bodies remain unchanged.

Unreviewed server-side HTTP errors also hide their messages while retaining their
status. The explicitly reviewed storage-upload retry message remains a `503`.
Logs use allowlisted error types/codes, numeric upstream status and a hashed stack
frame fingerprint—not raw exception messages, stacks, SQL, parameters or provider
request/response payloads. Request summaries log route templates rather than query
strings or dynamic path values. Unknown-route responses do not echo request URLs.

Set `CORS_EXPOSED_HEADERS` to include `X-Request-ID` if browser clients need to read
the header. Server-error responses also include it in the JSON body.

## Request deadlines

Ordinary requests use `REQUEST_TIMEOUT_MS` (default five seconds). Avatar uploads use a 90-second route deadline,
allowing multipart validation and the storage PUT's 60-second deadline.

A deadline returns `408` through the normal error pipeline without terminating
the process. It does not forcibly cancel in-flight promises or release a database
connection while work is using it. Shared application transactions check request
cancellation immediately before commit: work that expires before that check drains,
rolls back, then runs upload compensation and temporary-file cleanup. Disconnects
also cancel pending work; rollback compensation is allowed to finish after the
deadline. Non-request worker transactions are unaffected.

The database commit itself cannot be cancelled atomically with the HTTP timer.
A deadline/disconnect racing an already-started commit can still leave a committed
operation without a successful response. Retry protected operations with their
original idempotency key; otherwise reload current state before issuing a new
mutation. Infrastructure operations retain their own deadlines; an HTTP timeout
does not guarantee immediate resource reclamation.

## Reference data

Public startup/form reference endpoints use `/api/v1/public/library/{countries,timezones,genders,statuses,roles}`. The public API module owns the library controller, which composes the library and identity domains without changing lookup response shapes. The old `/api/v1/library/...` routes are no longer mounted; clients must update their URLs. Countries include region and phone/address validation metadata. Time zones have a generated record ID and a separate unique IANA `key`, plus display fields; the IANA key is not the database ID.

Role listings are display/reference data, not authorization grants. Never derive allowed actions from a client-selected role label.
