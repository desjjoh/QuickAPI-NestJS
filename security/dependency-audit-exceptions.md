# Dependency audit policy

Base CI runs `npm run security:audit` independently of release-image scanning.
The command audits production dependencies (`npm audit --omit=dev --json
--audit-level=info`) and the full tree (`--include=dev`). It uses npm's executable
from the invoking npm process, with a two-minute deadline per audit.

Unexcepted production **critical** advisories block approval, including
findings without a fix. High, moderate, low, and informational findings remain visible in the production summary and raw report.
The full-tree report is also retained, with a separate nonblocking summary for
package findings whose installed paths are all marked `dev` in the lockfile.
Production/mixed-scope packages are never relabeled as development-only.

Both audit results must be available and valid. Command failure, registry errors,
missing/incomplete JSON, inconsistent counts/status, missing lockfile evidence,
unknown blocking advisory identifiers, and invalid policy fail closed. An
exception cannot excuse missing audit evidence.

## Exceptions

The register is [dependency-audit-exceptions.json](dependency-audit-exceptions.json).
It starts empty. Entries must identify one exact GHSA advisory, package, and list
of exact installed versions; no wildcard or version range is accepted. Every
entry needs an owner, a justification, and an expiry timestamp at most 30 days
ahead. Exceptions expire at that exact UTC timestamp. Expired, duplicate,
malformed, and unused/mismatched exceptions fail the gate.

Example structure (not an approved exception):

```json
{
  "advisory": "GHSA-abcd-1234-5678",
  "package": "affected-package",
  "versions": ["1.2.3"],
  "owner": "named reviewer",
  "justification": "Reviewed impact, mitigation, remediation issue and planned fix",
  "expires": "2026-11-01T00:00:00Z"
}
```

Keep excepted findings visible. Prefer a compatible dependency fix over an
exception; changing the register is explicit risk acceptance, never automatic
remediation. Re-review before renewal and remove exceptions after remediation.

## Evidence and usage

```bash
npm run test:security
npm run security:audit
```

These commands also work in PowerShell; no Bash or Docker is required. Tests use
synthetic reports and fake npm results, without network access. The real audit
uses the configured npm registry, does not install or update dependencies, and
writes ignored `.release-check/dependency-audit/` evidence:

- `production-audit.json`: raw production result;
- `full-audit.json`: raw full-tree result;
- `result.json`: gate decision, matched exceptions, development-only summary, and errors;
- `summary.md`: readable production/development decision.

CI retains these files and the exception register for 14 days, including failure
evidence, and connects the audit job to both `Check` and `Staging deployment gate`.
Audit availability failures block evidence approval even though development-only
vulnerabilities are nonblocking. A successful audit is time-specific registry
evidence; it does not establish runtime exploitability or replace image scanning.

The existing [container policy](container-vulnerability-exceptions.md) remains a
separate release-time OS/Node scan that blocks unexcepted critical findings.
This change does not alter that severity policy or its exception register.
