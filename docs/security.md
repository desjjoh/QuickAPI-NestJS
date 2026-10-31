# Security

[Documentation index](../README.md#documentation)

## Identity and authorization

The authentication stack includes:

- Local credential validation for sign-in
- JWT access-token strategy
- Refresh-token strategy
- HTTP-only refresh-token cookie handling
- CSRF token issuance and guard support
- Permission decorators and permission guard enforcement
- Platform-admin decorator support for administrative endpoints

The account and administration APIs rely on the same shared identity/domain layer, keeping HTTP concerns in controllers, application decisions in domain services, and persistence in repositories.

Authentication also includes MFA, verification/reset challenges, session revocation,
and account tombstones. Deletion state comes from the dedicated account status,
never a display name or email. Administration requires the declared permissions;
a public role catalog does not grant authority. See [account and audit contracts](api-contracts.md#account-deletion-and-historical-identity).

Access tokens and cookie/CSRF credentials have different responsibilities. Refresh
cookies are HTTP-only; the CSRF cookie is browser-readable. Match cookie scope,
SameSite, secure flags, and lifetime to the actual browser/API topology. Security
operations reject idempotency keys and stage cookie changes until commit; ordinary
replay never grants permission to bypass current authorization.

## Browser and proxy boundaries

Use HTTPS publicly and secure cookies in HTTPS environments. Configure explicit
credentialed browser origins and retain `Idempotency-Key` and `X-CSRF-Token` in
allowed request headers. CORS controls browser access, not endpoint authorization.
See [Configuration](configuration.md) for the maintained environment examples.

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

## Rate limiting

Nest's throttler stores counters in the same Redis service used by BullMQ, so
limits apply across every API replica rather than independently per process.
The authentication policies are intentionally separate: sign-in is 5/minute,
registration is 3/minute, registration resend is 2/minute, password-reset
request is 3/minute, and OTP confirmation is 5/minute per client and route.

Redis availability is required for request throttling. This is deliberately
fail-closed rather than silently falling back to process-local counters.

See [API contracts](api-contracts.md#authentication-and-request-policy) for the
429 response and retry headers. Do not bypass Redis failures with per-process
counters without explicitly changing the distributed enforcement contract.

## Operational access

`/health` and `/ready` are unauthenticated platform probes with limited responses.
Outside development, metrics and detailed diagnostics require their respective
enabled flags and the deployment-only `X-Operations-Key` credential. Disabled
surfaces return 404; absent/invalid credentials return 401. The credential is not
an end-user access token and must not be sent to a browser client.

Development guards bypass the enabled/key checks. Never expose a development
instance publicly. Swagger is mounted only when `DOCUMENTATION_ENABLED=true`;
`/docs` and `/docs-json` are not protected by the operations guards. Disable them
or restrict them at ingress. Deployment restrictions are described in
[Deployment](deployment.md#staging-compose-contract).

## Sensitive data and failure handling

Unexpected errors return a generic message with a server-generated request ID.
Diagnostics allowlist safe error classifications rather than raw SQL, parameters,
credentials, or provider payloads. See [error responses](api-contracts.md#error-responses-and-correlation).

Audits redact original email values, passwords, hashes, tokens, and challenge
secrets. Deletion retains historical identity fields and replaces the account email;
it is not comprehensive privacy erasure. Replay snapshots can contain personal
data and follow their own retention/access policy. See [API contracts](api-contracts.md)
for exact response, audit, and replay behavior, and [Reliability](reliability.md)
for encrypted email intents, cleanup records, DLQ privacy, and recovery limits.

## Dependency and image security

Base CI's `npm run security:audit` checks production and full dependency trees.
Unexcepted critical production findings, invalid evidence, and audit failures block
approval. High and lower production findings remain reported; development-only
findings are reported separately. The release-image gate separately scans OS and
application packages and blocks unexcepted critical findings, including unfixed ones.

Exact scope, reviewer ownership, expiry, and evidence requirements live in the
[dependency policy](../security/dependency-audit-exceptions.md) and
[container policy](../security/container-vulnerability-exceptions.md). Their JSON
registers are the authoritative exceptions; this guide does not duplicate them.
Exceptions require explicit risk acceptance. Audits and scans do not update packages.

See [Testing](testing.md#dependency-security-in-base-ci) for gate checks and
[Deployment](deployment.md#release-images-and-supply-chain-evidence) for exact-image
qualification and publication. A passing scan is time-specific evidence, not a
permanent security or deployment guarantee.

## Deployment responsibilities

The deployment owner supplies secrets, ingress restrictions, trusted proxy ranges,
provider permissions, backup/retention policy, and recovery evidence. Local tests
use fake external providers. Outstanding application and environment-owned work is
tracked in [Backlog](backlog.md); neither tests nor this guide constitute an
independent security assessment.
