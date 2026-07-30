# Activity audit design

## Purpose and principles

The audit trail provides durable answers to **who did what, to which resource,
when, from where, and with what result**. It is a security and accountability
record, not an ordinary application log. Application logs remain the place for
debug messages, stack traces, timings, and high-volume operational detail;
those messages may be sampled, reformatted, or deleted independently of the
audit trail.

Audit records are append-only. Application code may insert them but must not
update or delete them. Corrections are represented by a new record that refers
to the erroneous record in metadata. Storage permissions, migrations, and
operational tooling must enforce this rule. Access to audit data is itself
restricted and should be audited.

Records must remain understandable after an actor, subject, session, or entity
has been deleted. IDs and the non-secret, point-in-time display context needed
for an investigation may therefore be retained in metadata rather than relying
on joins to mutable application tables. Audit rows must not use foreign-key
cascades to users or domain entities.

## Record forms

Every record is emitted through `AuditService.record(input, manager?)`. A
record is either a semantic event without snapshots or an event carrying a
redacted, changed-only snapshot diff; no category discriminator is stored.

### Semantic events

An activity event is explicitly recorded by the owning domain or application
service and captures a semantic, security-relevant action and its outcome. It
describes intent at the service or use-case boundary rather than merely
describing rows written by that action. Initial event keys include:

| Stable event key                               | When it is emitted                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `identity.registration.requested`              | A registration request is accepted for processing                                           |
| `identity.registration.verification_succeeded` | A pending registration is verified and its user is created                                  |
| `identity.registration.verification_failed`    | A registration verification is rejected after its outcome is known                          |
| `identity.registration.verification_resent`    | A replacement registration verification challenge is issued                                 |
| `identity.sign_in.succeeded`                   | Authentication succeeds                                                                     |
| `identity.sign_in.failed`                      | Authentication fails, including an unknown account                                          |
| `identity.mfa.sign_in.challenge_issued`        | A password-authenticated sign-in requires an MFA challenge                                  |
| `identity.mfa.sign_in.verification_succeeded`  | A sign-in MFA challenge is successfully verified                                            |
| `identity.mfa.sign_in.verification_failed`     | A sign-in MFA challenge is rejected after its outcome is known                              |
| `identity.session.issued`                      | An access/refresh session is created or rotated                                             |
| `identity.refresh.succeeded`                   | A refresh session is successfully validated and rotated                                     |
| `identity.refresh.failed`                      | A refresh attempt is rejected after its outcome is known                                    |
| `identity.sign_out.completed`                  | The active session is revoked and sign-out completes                                        |
| `identity.password_reset.requested`            | A password reset is requested, regardless of whether the public response reveals an account |
| `identity.password_reset.code_accepted`        | A password-reset code is accepted                                                           |
| `identity.password_reset.code_rejected`        | A password-reset code is rejected without retaining the submitted code                      |
| `identity.password_reset.completed`            | A verified password reset changes the password                                              |
| `identity.password.changed`                    | An authenticated user changes their password                                                |
| `identity.email_verification.requested`        | Initial email verification is requested                                                     |
| `identity.email_verification.completed`        | Initial email verification completes                                                        |
| `identity.email_change.requested`              | Verification of a new email address is requested                                            |
| `identity.email_change.completed`              | A verified email change completes                                                           |
| `identity.mfa.enrollment_requested`            | MFA enrollment is requested                                                                 |
| `identity.mfa.enabled`                         | MFA enrollment is successfully completed                                                    |
| `identity.mfa.disabled`                        | MFA is disabled                                                                             |
| `identity.session.revoked`                     | A session is revoked by its owner, an administrator, or the system                          |
| `identity.session.all_revoked`                 | All applicable sessions are revoked; metadata contains session IDs only                     |
| `identity.account.deleted`                     | A user deletes their own account                                                            |
| `identity.profile.updated`                     | A user profile update succeeds                                                              |
| `admin.user.deleted`                           | An administrator deletes or soft-deletes a user                                             |

Emit attempts whose result matters to security, including failures. Where an
operation has meaningful requested and completed phases, use separate keys
(for example, `identity.password_reset.requested` and
`identity.password_reset.completed`) rather than changing the meaning of an
existing key.

### Events with snapshots

An entity change is also explicitly recorded by the owning domain or
application service and captures the persistence-level mutations that the
operation is designed to audit. Its stable action key is one of:

- `entity.insert`
- `entity.update`
- `entity.soft_delete`
- `entity.restore`
- `entity.delete`

One semantic activity can produce multiple entity changes. For example,
enabling MFA can emit one `identity.mfa.enabled` event and changes for the user
and recovery-code entities. These records are complementary and should share a
request ID (and, where useful, an operation/correlation ID in metadata). The
owning service emits each record directly with the shared context.

## Explicit recording ownership

Audit recording is intentionally explicit. The domain or application service
that owns an operation knows information that cannot be reliably reconstructed
from a generic persistence hook:

- the semantic meaning of the operation;
- the authenticated actor;
- the affected subject;
- which entity fields matter;
- which relationships changed;
- whether the operation succeeded;
- the correct before and after representations;
- the transaction in which the audit record belongs.

Accordingly, audit records must not be produced through TypeORM entity
subscribers, entity listeners, global mutation observers, or automatically
inferred entity changes. Low-level repository changes that bypass an audited
service are not automatically captured and are unsupported for audited
mutations. All audited mutation paths must go through the owning service that
explicitly emits their records.

## Shared envelope

Use a single logical envelope for both categories. Fields that do not apply are
`null`; do not invent placeholder IDs. JSON examples use snake case to match a
storage/API representation, while implementation names may follow TypeScript
conventions.

| Field              | Type                  | Required    | Meaning                                                                                     |
| ------------------ | --------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| `audit_record_id`  | string/UUID           | yes         | Globally unique, immutable audit record ID; preferably time-sortable                        |
| `event_action_key` | string                | yes         | Stable machine key from the controlled catalog, never a display message                     |
| `outcome`          | enum                  | yes         | `succeeded`, `failed`, `denied`, `pending`, or `unknown`                                    |
| `actor_type`       | enum                  | yes         | `user`, `anonymous`, `service`, `admin`, or `system`                                        |
| `actor_id`         | string, nullable      | conditional | Identifier of the party that initiated the action; absent for anonymous/system actors       |
| `subject_type`     | string, nullable      | conditional | Type of aggregate owner or party affected                                                   |
| `subject_id`       | string, nullable      | conditional | Identifier of the aggregate owner or party affected                                         |
| `resource_type`    | string, nullable      | conditional | Type of the specific object affected                                                        |
| `resource_id`      | string, nullable      | conditional | Identifier of the specific object affected                                                  |
| `domain`           | string                | yes         | Domain that owns the event definition                                                       |
| `operation_id`     | string, nullable      | no          | Identifier shared by audit events belonging to one logical operation                        |
| `idempotency_id`   | string, nullable      | no          | Identifier used to correlate retries of an idempotent operation                             |
| `request_id`       | string, nullable      | conditional | Request correlation ID; required for HTTP-sourced records and propagated to downstream work |
| `session_id`       | string, nullable      | no          | Opaque session identifier when available; never a bearer or refresh token                   |
| `ip_address`       | string, nullable      | no          | Canonical client IP after applying the trusted-proxy policy                                 |
| `user_agent`       | string, nullable      | no          | Bounded, sanitized HTTP user-agent value                                                    |
| `http_method`      | string, nullable      | conditional | Uppercase method for HTTP records                                                           |
| `normalized_route` | string, nullable      | conditional | Route template such as `/api/v1/users/:id`, never the raw URL or query string               |
| `source`           | enum                  | yes         | `http`, `queue`, `scheduled_job`, `seed`, `migration`, or `system`                          |
| `occurred_at`      | timestamp             | yes         | UTC time the audited action occurred, distinct from storage ingestion time                  |
| `metadata`         | JSON object           | yes         | Versioned, structured, allowlisted context; `{}` when none                                  |
| `before`           | JSON object, nullable | no          | Allowlisted pre-change values where applicable                                              |
| `after`            | JSON object, nullable | no          | Allowlisted post-change values where applicable                                             |
| `changed_fields`   | JSON object, nullable | no          | Field-level changes where applicable, preferably `{field: {before, after}}`                 |

An implementation may add `schema_version`, `ingested_at`, integrity/hash, and
trace/correlation fields without changing this contract. Store timestamps with
timezone awareness and serialize them in UTC ISO 8601 form.

### Actor, subject, resource, and domain rules

The actor initiated the action. The subject is the aggregate owner or party the
action concerns, while the resource is the specific object affected. The domain
owns the event definition.
For self-service actions, `actor_id` and `subject_id` may be equal.
For an administrator deleting another user, the administrator is the actor, the
deleted user is the subject, and that user's record is the resource. For an unauthenticated sign-in failure,
`actor_type` is `anonymous`, `actor_id` is null, and metadata may contain a
one-way keyed hash of the normalized login identifier; it must not contain the
raw identifier. Automated work uses `service` or `system` plus a stable service
name in metadata.

### Stable keys and readable context

`event_action_key` is an immutable identifier for querying and policy. Human
text such as "John signed in" is presentation generated from the key and
structured fields, never the identifier. Keys use lowercase dotted namespaces
and are not renamed for wording changes. A semantic change requires a new key;
retired keys remain documented so historical data stays interpretable.

Point-in-time metadata may include bounded values such as actor role, actor
display label, subject display label, reason code, client application, and job
name. Prefer IDs and controlled reason codes. Labels must be minimal and
explicitly allowlisted because they outlive the source record.

### Change snapshots

When snapshots are supplied, `before`, `after`, and `changed_fields` include only fields
approved for auditing:

- insert: `after` is populated; `before` is null;
- update: `before`, `after`, and `changed_fields` contain changed allowlisted
  fields only;
- soft-delete: include the deletion-state transition and relevant identifiers;
- restore: include the restoration-state transition and relevant identifiers;
- delete: `before` contains the minimal allowlisted final state; `after` is
  null.

Never take an indiscriminate entity snapshot. Exclude password hashes, MFA
secrets and recovery codes, access/refresh/session tokens, API keys, cookies,
CSRF values, encryption keys, and raw file contents. Secret fields should be
recorded only as a fact such as `password_changed: true`, not as old/new values.

Relationship values use an explicit, bounded representation. A one-to-one
relationship may use an explicitly allowlisted nested object. One-to-many and
many-to-many relationships must be represented only as arrays of related
entity IDs; relationship arrays must never contain full related objects.

## Capture and delivery

1. Establish request context early and normalize the route from the framework's
   route template. Trust forwarded IP headers only from configured proxies.
2. The owning domain or application service manually emits both activity
   events and entity changes at the point where the outcome and correct
   representations are known, using the same context.
3. Commit successful mutation audit records atomically with the business
   transaction, or write an outbox entry in that transaction for durable
   delivery. Never report a successful mutation that later rolls back.
4. Record rejected/failed actions through a failure-safe path because their
   business transaction will not commit. If audit persistence fails, security-
   critical administrative operations should fail closed; other operations
   must raise an operational alert and a metric rather than silently discard
   the audit record.
5. Consumers must be idempotent on `audit_record_id`. Queue retries must not
   create duplicate records.

The audit service validates keys and field bounds, redacts disallowed data, and
rejects malformed records. Audit-write failures may be reported in application
logs, but the audit payload itself must not be duplicated into those logs.

## Retention and integrity

Default online retention is **400 days**, followed by encrypted archival for a
total retention period of **7 years**. The security/privacy owners may define a
different period per jurisdiction or record class in a documented retention
schedule. Legal holds suspend expiry for the relevant records. At the end of
the applicable period, automated lifecycle jobs irreversibly delete records
and produce a non-sensitive deletion report.

Use an access-controlled store separate from ordinary domain tables, encrypted
in transit and at rest. Grant application identities insert-only access and
grant read access only to authorized security, privacy, and support roles.
Backups and replicas follow the same retention and access policies. Database
constraints, restricted credentials, and preferably tamper-evident hashes or
immutable/WORM archival should make alteration detectable. Monitor ingestion
lag, rejected records, gaps, and unauthorized access.

## Expected query patterns

The store and indexes should support bounded time-range queries for:

- all activity involving an actor or subject user;
- authentication failures by time, keyed login hash, IP, or session, including
  detection of bursts and account attacks;
- a request's complete semantic and entity-change history by `request_id`;
- the history of an entity by `(resource_type, resource_id)`;
- administrative actions by event key, actor, subject, outcome, and time;
- session creation/revocation investigations by `session_id`;
- changes to a named field using `changed_fields`;
- retention, legal-hold, and compliance exports by time and domain/event.

Likely composite indexes begin with `occurred_at` and include
`(actor_id, occurred_at)`, `(subject_id, occurred_at)`,
`(event_action_key, outcome, occurred_at)`, `(resource_type, resource_id,
occurred_at)`, `request_id`, and `session_id`. Partition primarily by time.
Avoid unrestricted JSON scans on the primary store; promote frequently queried
metadata to governed columns or a purpose-built secondary index.

## Privacy and access expectations

Audit collection must be purposeful and data-minimized. Document its lawful
basis, disclose it in the applicable privacy notice, and apply jurisdictional
retention requirements. Treat IDs, IP addresses, user agents, snapshots, and
metadata as confidential personal data. Use role-based least privilege,
strong authentication, audited exports, bounded search windows, and rate
limits. Mask fields in support views and encrypt especially sensitive metadata
with separately managed keys where required.

Do not place raw request/response bodies, query strings, authorization headers,
credentials, secrets, tokens, or unbounded exception text in an audit record.
Normalize and length-limit network/client strings to prevent log injection and
storage abuse. Data-subject access or deletion requests must follow the legal
retention policy: where erasure is required, prefer deletion or irreversible
pseudonymization of identifying fields while retaining only records that the
organization is legally permitted or required to keep. Any transformation is
performed by privileged lifecycle tooling and leaves a separate, non-identifying
accountability record; it is not an ordinary update path.

## Deliberate exclusions

The following are not audit activities unless they cause a separately defined
security-relevant action or entity mutation:

- health, readiness, and liveness probes;
- metrics scraping and telemetry export;
- ordinary reference-data reads, such as listing countries or statuses;
- static asset requests and routine API documentation access;
- routine successful reads of non-sensitive resources;
- debug, trace, performance, SQL, and framework lifecycle messages;
- duplicate low-level changes already represented within the same transaction
  solely because an ORM reloaded an unchanged entity.

Sensitive-data reads, permission changes, exports, impersonation, audit-log
access, and other high-risk operations should receive explicit stable activity
keys even when no database mutation occurs. Exclusion is based on the semantic
activity, not merely on HTTP method or status code.
