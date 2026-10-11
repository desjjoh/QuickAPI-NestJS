# API contracts

[Documentation index](../README.md#documentation)

Enabled Swagger is the endpoint/schema reference. This guide records cross-request guarantees clients must understand.

## Article API audiences

Article API controllers and services are grouped under `src/modules/api/v1/public`, `creator/articles`, and `administration`. Public and creator audience modules are routed independently; administration owns its article controller. Shared article query and outbound models, application rules, and persistence remain in the articles domain module.

- Public reads: `/api/v1/public/articles` and `/api/v1/public/articles/:id`.
- Creator reads and creation: `/api/v1/creator/articles`; detail and updates: `/api/v1/creator/articles/:id`; hero replacement, submission, and withdrawal: `/:id/hero`, `/:id/submit`, and `/:id/withdraw` beneath that creator collection.
- Administration: `/api/v1/administration/articles`, including `/:id/publish` and the other review/lifecycle actions.

This is a breaking route change: the former `/api/v1/articles` public routes and `/api/v1/articles/creator` creator routes are no longer mounted. Clients must update their URLs when adopting this release; no temporary aliases are provided. Swagger groups article operations as Public Articles, Creator Articles, and Article Administration.

Creator and administration article list/detail and mutation responses include a numeric `version`. Send that value as `expected_version` for content updates, hero replacements (a multipart field), submission/withdrawal, and administration lifecycle actions. A successful mutation increments the article version, including hero-only and unchanged-content edits. Missing or invalid versions fail request validation; stale versions return `409 Conflict` without mutation or an audit event. On conflict, reload and reconcile the article before retrying rather than blindly retrying the stale edit. Public article responses do not expose the version. Apply all pending migrations before deploying this contract; existing articles start at version 1.

---

### Article content validation

Creation requires non-null title, summary, and body containing visible text. Updates may omit any content field to keep its existing value, but explicit `null` is invalid. Title and summary remain limited to 255 characters. Body storage remains MySQL `TEXT`: both creation and updates enforce a maximum of **65,535 UTF-8 bytes**, not characters (multibyte content reaches this limit sooner). Invalid content returns `422` before persistence, version increments, success audits, or permanent uploads; multipart temporary files are cleaned up.

### Article listing indexes

The article query-index migration adds three indexes matching the existing repository filters and deterministic ordering: public `(status_id, publishedAt, id)`, creator `(author_id, createdAt, id)`, and administration review `(status_id, createdAt, id)`. Entity metadata uses the corresponding embedded property paths. Both ASC and DESC ordering use the same indexes; no combined author/status or search index is added without measurements. Leading-wildcard title/summary searches are not made indexable by these indexes, and unfiltered administration ordering is a separate access pattern.

Article lists now count a lean filtered scope, select ordered article IDs with LIMIT/OFFSET, then load display fields for that page only. The display query selects article timestamps/title/summary/version, status, hero, and author name/avatar. It does not select body, publisher, credentials, contacts, roles or permissions. Author filtering uses the article foreign key directly; status filtering joins only the status table. Both title/summary search branches remain inside the audience scope, and the display query reapplies the same scope. ID-page order is restored explicitly after loading display rows. A typed domain list read model avoids exposing partially loaded entities. Detail and mutation loading are unchanged; no migration or API response changes are required.

Independent list requests use a short service-owned REPEATABLE READ transaction so count, IDs and display values share one snapshot without row locks. Existing application/caller transactions are reused, retaining their isolation level and lifecycle; callers needing the same snapshot guarantee must use REPEATABLE READ. There are three SELECTs for a populated page, two for an out-of-range page, and one for an empty scope, with no per-article queries. The read transaction holds a pool connection until these queries complete. Snapshots do not make pagination across separate requests immutable, and a response can reflect data committed before a concurrent unpublish/delete.

The article E2E suite includes a quiet EXPLAIN case with 16,000 synthetic articles, skewed statuses, selective authors and tied dates. It captures the actual count, ID-page and display SQL, compares the ID-page join footprint against the former eager pagination plan, checks that ID selection joins at most the article/status tables, and checks primary-key access for page hydration. Public, creator and review lists in both directions verify index eligibility and indexed filter prefixes without mandating one optimizer choice. Combined author/status and unfiltered administration queries are also exercised. A small-fixture regression compares complete outbound projections/counts/order with the former eager path, including empty pages and nullable bylines/avatars, and changes status on another connection after count to verify the service snapshot. Filesort can remain for some patterns; reduced joins are not a claim of measured latency improvement. Validate representative plans and timings locally before deployment rather than adding FORCE INDEX or speculative indexes.

After configuring the disposable environment in [Testing](../test/TESTING.md), run just that check manually:

```powershell
node --no-warnings --experimental-vm-modules ./node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand --runTestsByPath test/e2e/articles/articles.e2e-spec.ts --testNamePattern="EXPLAINs actual article pagination SQL"
```

Global setup resets only the explicitly configured disposable test schema and applies the migration. Validate plans against realistic cardinalities before deployment; a failing eligibility/filtering assertion is a signal to revisit the index/query rather than add FORCE INDEX. The down migration preserves foreign-key supporting indexes if InnoDB replaced their implicit indexes with these composites. Index creation can lock/work on a large table: schedule the production migration appropriately.

The index rollback inspects the live schema and preserves surviving foreign-key supporting indexes, or restores them for `author_id` and `status_id` before dropping the listing indexes. It skips already-missing listing indexes so an interrupted rollback can resume: MySQL DDL implicitly commits, so a logged `ROLLBACK` does not restore a previously dropped index. The compiled migration revert/forward smoke check exercises this deployment boundary without tests importing individual migration classes.

### Article search contract

All article audiences use the same domain search policy: a literal substring in **title or summary**, never body. `%`, `_`, `!`, backslashes and quotes are ordinary search text, not wildcard/operator syntax. SQL uses a bound parameter with an explicit `!` LIKE escape character. Queries are normalized to Unicode NFC, trimmed, and have runs of whitespace (including tabs/newlines) collapsed to one space. Whitespace-only input means no search filter. This is contiguous phrase matching, not independent keyword matching; stored content is not rewritten or whitespace-normalized. The API validates the raw query's 255-character limit before normalization.

Matching explicitly uses MySQL 8's `utf8mb4_0900_ai_ci` collation: case- and accent-insensitive according to that collation's Unicode comparison rules, regardless of the column's default collation. Public published-only visibility, creator ownership/status, and administration author/status filters apply independently to **both** title and summary branches, including their pagination counts. Search never expands the caller's authorized scope.

Policy/repository unit cases and the article E2E suite cover literal wildcard/escape characters, backslashes, SQL-looking text, blank input, whitespace, Unicode composition, case/accent matching, body exclusion and scoped title/summary results. Run these regressions with the disposable dependencies described in [Testing](../test/TESTING.md).

Keep this SQL approach until measured volume/latency justifies full-text indexes or a dedicated search service. Leading-wildcard substring search is not accelerated by ordinary title/summary indexes. Before changing engines, define any changes to tokenization, phrases, stopwords, ranking and short-word handling explicitly. Treat search results as candidate IDs only: independently enforce current visibility, status and ownership in the authoritative database before returning records or counts. Do not rely on a search index's potentially stale authorization data.

## Request idempotency

Article creation, creator hero replacement, administration publish/archive/restore, and account profile avatar/phone/address creation, replacement, and removal accept an optional `Idempotency-Key`. The profile routes are `POST` and `DELETE /api/v1/account/profile/{avatar,phone,address}`. Generate a fresh key for each intended action, then keep the same key and payload (including `expected_version` where required and identical image bytes/client filename) for network retries. Keys must contain 1–128 printable, non-whitespace ASCII characters and no commas. Requests without a key retain their existing behavior. Profile POST responses remain `201`, and profile DELETE responses remain `200`; other opted-in operations returning `204` replay without a response body.

Keys are scoped to the authenticated actor, operation, and HTTP method/resource path. For 24 hours, identical retries return the original JSON body and HTTP status, even if the resource has since changed. Replaying a profile delete does not delete a subsequently recreated avatar or contact. A replayed profile response is a historical snapshot, not current profile/session/permission state; fetch the current account when that distinction matters. A different payload using the same key returns `409 Conflict`; an overlapping request also returns `409` and can be retried with backoff after the first finishes. Authentication, permissions, CSRF protection, and rate limits still apply to retries. Validation and transaction failures roll back the claim so the action can be retried safely.

The reusable `Idempotent` decorator/interceptor and system idempotency service own this concern; controllers only opt in. When adding another operation, import `IdempotencyModule`, apply the decorator above any multipart interceptor, and use `runInTransaction` for all database mutations so they share the request transaction and lifecycle. Explicitly pass that transaction manager to downstream writes and audit calls. Identity and audit services resolve their default managers through `applicationManager`, so they also join the active application transaction; other services must explicitly opt in or receive the manager. Nontransactional external effects still need lifecycle compensation or an outbox; this is not a general guarantee of exactly-once delivery to external systems. This decorator is not suitable unchanged for anonymous authentication or token/cookie-issuing flows.

The MySQL implementation uses non-waiting connection-scoped advisory locks across API replicas and commits the action, audit events, and replay record together. Replay eligibility expires after 24 hours and retries do not extend expiry. Expired rows are swept hourly while the application is running, so physical removal can lag expiry; backups have their own retention. After expiry a reused key is a new action. Existing browser deployments must add `Idempotency-Key` to `CORS_ALLOWED_HEADERS`.

Profile response snapshots include personal information (email, date of birth, contacts, and display/session metadata) already present in `UserDto`. They do not contain password hashes or access/refresh tokens. The store persists a request fingerprint, not the request payload or uploaded bytes, and hashes the raw client key into the scope identifier. Restrict table/backup access as for identity data, encrypt database storage and backups operationally, and include snapshots in retention/erasure procedures. Expiry is not immediate account-erasure cleanup. Never opt credential/token responses into this full-response store without a separate security and replay policy.

Administrator user mutations also accept `Idempotency-Key`: `PATCH /api/v1/administration/users/:id` replays the original `200` user representation, and `POST /api/v1/administration/users/:id/delete` replays bodyless `204` after the target has been deleted. The key includes the administrator and target route; a changed reason/status/role payload conflicts. Update/deletion, the success audit, and the replay record commit together; avatar storage deletion is scheduled transactionally and executed asynchronously after commit. Current authentication and endpoint permissions are checked on every retry. If the administrator deletes their own account or loses the required permission, replay does not bypass that loss of access.

Administration user list/detail/update responses include `version`, backed by `users.administration_version`. `PATCH /api/v1/administration/users/:id` and `POST /api/v1/administration/users/:id/delete` require a numeric `expected_version` and a controlled `reason_code`. This is a breaking request-contract change: missing/invalid revisions fail validation with `422`; stale revisions return `409` before mutation, audit or storage cleanup. Reload and reconcile the user before sending a new action. Successful updates advance the revision exactly once, including accepted no-op actions, and revision changes roll back with failed mutations/audits. Delete compares the current revision under the existing row lock before cleanup. The revision tracks status/role administration, including other application status/role writes through the shared user service; profile edits and sign-in activity do not advance it. Ordinary account/authentication responses remain unchanged. Shared user writes cannot restore an old revision or save unrelated stale root status/role fields.

Apply all pending migrations before deploying the new API; existing users start at revision 1. An identical completed keyed retry still replays the historical response (including its historical version) without checking that old revision against current state. Changed payloads, including a changed expected_version under a completed key, conflict. A failed stale action leaves no replay claim, so a corrected request can retry; current authentication and permissions still apply. Idempotency keys/request IDs are not substitutes for version checks. Administrator replay snapshots retain personal information under the retention/access policy above. Deployment rollback must coordinate client contracts and older writer processes: old versions that do not maintain administration revisions cannot safely coexist with the new concurrency contract.

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

Ordinary requests use `REQUEST_TIMEOUT_MS` (default five seconds). Avatar uploads,
article creation with a hero, and hero replacement use a 90-second route deadline,
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

Public form/reference endpoints use `/api/v1/library/{countries,timezones,genders,statuses,roles}`. Countries include region and phone/address validation metadata. Time zones have a generated record ID and a separate unique IANA `key`, plus display fields; the IANA key is not the database ID.

Role listings are display/reference data, not authorization grants. Never derive allowed actions from a client-selected role label.
