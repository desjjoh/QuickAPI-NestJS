'use strict';

const { spawnSync } = require('node:child_process');
const {
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
} = require('node:fs');
const { resolve, join } = require('node:path');

const severities = ['info', 'low', 'moderate', 'high', 'critical'];
const blocking = new Set(['critical']);
const advisoryPattern =
  /^https:\/\/github\.com\/advisories\/(GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4})$/;
const versionPattern =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function requireValid(condition, message) {
  if (!condition) throw new Error(message);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateExceptions(policy, now = Date.now()) {
  requireValid(isObject(policy), 'Missing exception policy');
  requireValid(
    Object.keys(policy).sort().join(',') === 'exceptions,version',
    'Malformed exception policy fields',
  );
  requireValid(
    policy.version === 1 && Array.isArray(policy.exceptions),
    'Unsupported exception policy',
  );
  const keys = new Set();
  for (const exception of policy.exceptions) {
    requireValid(isObject(exception), 'Malformed exception');
    requireValid(
      Object.keys(exception).sort().join(',') ===
        'advisory,expires,justification,owner,package,versions',
      'Malformed exception fields',
    );
    requireValid(
      typeof exception.advisory === 'string' &&
        /^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/.test(exception.advisory),
      'Invalid exception advisory',
    );
    for (const field of ['package', 'owner', 'justification']) {
      requireValid(
        typeof exception[field] === 'string' &&
          exception[field].trim().length > 0,
        `Missing exception ${field}`,
      );
    }
    requireValid(!/[\s*]/.test(exception.package), 'Invalid exception package');
    requireValid(
      Array.isArray(exception.versions) &&
        exception.versions.length > 0 &&
        exception.versions.every(
          (version) =>
            typeof version === 'string' && versionPattern.test(version),
        ),
      'Exception requires exact versions',
    );
    requireValid(
      new Set(exception.versions).size === exception.versions.length,
      'Duplicate exception versions',
    );
    const expiry = Date.parse(exception.expires);
    requireValid(
      typeof exception.expires === 'string' &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(exception.expires) &&
        Number.isFinite(expiry) &&
        new Date(expiry).toISOString() ===
          exception.expires.replace('Z', '.000Z'),
      'Invalid exception expiry',
    );
    requireValid(expiry > now, 'Expired exception');
    requireValid(
      expiry <= now + 30 * 24 * 60 * 60 * 1000,
      'Exception expiry exceeds 30 days',
    );
    for (const version of exception.versions) {
      const key = `${exception.advisory}:${exception.package}:${version}`;
      requireValid(!keys.has(key), 'Duplicate exception scope');
      keys.add(key);
    }
  }
  return policy.exceptions;
}

function evaluateAudit(report, policy, lockfile, now = Date.now()) {
  const exceptions = validateExceptions(policy, now);
  requireValid(
    isObject(report) && report.auditReportVersion === 2 && !report.error,
    'Missing or unsupported audit evidence',
  );
  requireValid(
    isObject(report.vulnerabilities) &&
      isObject(report.metadata?.vulnerabilities),
    'Malformed audit evidence',
  );
  requireValid(
    isObject(report.metadata.dependencies) &&
      ['prod', 'dev', 'optional', 'peer', 'peerOptional', 'total'].every(
        (key) =>
          Number.isInteger(report.metadata.dependencies[key]) &&
          report.metadata.dependencies[key] >= 0,
      ) &&
      report.metadata.dependencies.total > 0 &&
      report.metadata.dependencies.prod > 0,
    'Missing dependency audit counts',
  );
  requireValid(
    lockfile?.lockfileVersion === 3 && isObject(lockfile.packages),
    'Missing lockfile evidence',
  );
  const counts = Object.fromEntries(
    severities.map((severity) => [severity, 0]),
  );
  const findings = new Map();
  for (const [name, entry] of Object.entries(report.vulnerabilities)) {
    requireValid(
      isObject(entry) &&
        entry.name === name &&
        severities.includes(entry.severity),
      `Malformed vulnerability: ${name}`,
    );
    requireValid(
      Array.isArray(entry.via) &&
        entry.via.length > 0 &&
        Array.isArray(entry.nodes) &&
        entry.nodes.length > 0,
      `Incomplete vulnerability: ${name}`,
    );
    counts[entry.severity]++;
    for (const node of entry.nodes) {
      requireValid(
        typeof node === 'string' &&
          node
            .split('/node_modules/')
            .at(-1)
            .replace(/^node_modules\//, '') === name &&
          typeof lockfile.packages[node]?.version === 'string',
        `Missing locked version: ${name}`,
      );
    }
    for (const via of entry.via) {
      if (typeof via === 'string') {
        requireValid(
          isObject(report.vulnerabilities[via]),
          `Missing transitive evidence: ${via}`,
        );
        continue;
      }
      requireValid(
        isObject(via) &&
          via.name === name &&
          severities.includes(via.severity) &&
          typeof via.url === 'string',
        `Malformed advisory: ${name}`,
      );
      const advisory = via.url.match(advisoryPattern)?.[1];
      requireValid(
        !blocking.has(via.severity) || advisory,
        `Unsupported blocking advisory identifier: ${name}`,
      );
      for (const node of entry.nodes) {
        const version = lockfile.packages[node].version;
        const key = `${advisory ?? via.url}:${name}:${version}`;
        findings.set(key, {
          advisory: advisory ?? via.url,
          package: name,
          version,
          severity: via.severity,
        });
      }
    }
  }
  const metadata = report.metadata.vulnerabilities;
  for (const severity of severities) {
    requireValid(
      Number.isInteger(metadata[severity]) &&
        metadata[severity] === counts[severity],
      `Inconsistent audit counts: ${severity}`,
    );
  }
  requireValid(
    metadata.total === Object.keys(report.vulnerabilities).length,
    'Inconsistent total audit count',
  );

  // Every blocking dependency chain must lead to an actual blocking advisory.
  function hasBlockingAdvisory(name, visited = new Set()) {
    if (visited.has(name)) return false;
    visited.add(name);
    return report.vulnerabilities[name].via.some((via) =>
      typeof via === 'string'
        ? hasBlockingAdvisory(via, new Set(visited))
        : blocking.has(via.severity),
    );
  }
  for (const [name, entry] of Object.entries(report.vulnerabilities)) {
    requireValid(
      !blocking.has(entry.severity) || hasBlockingAdvisory(name),
      `Unresolved blocking evidence: ${name}`,
    );
  }
  const used = new Set();
  const rows = [...findings.values()].map((finding) => {
    const index = exceptions.findIndex(
      (exception) =>
        blocking.has(finding.severity) &&
        exception.advisory === finding.advisory &&
        exception.package === finding.package &&
        exception.versions.includes(finding.version),
    );
    if (index >= 0) used.add(index);
    return { ...finding, exception: index >= 0 ? exceptions[index] : null };
  });
  requireValid(
    used.size === exceptions.length,
    'Unused exception: remove stale or mismatched scopes',
  );
  return {
    passed: rows.every(
      (row) => !blocking.has(row.severity) || row.exception !== null,
    ),
    counts,
    findings: rows,
  };
}

function readAuditResult(result) {
  requireValid(
    !result.error && !result.signal && [0, 1].includes(result.status),
    'Audit command failed or unavailable',
  );
  requireValid(
    typeof result.stdout === 'string' && result.stdout.trim().length > 0,
    'Missing audit output',
  );
  const report = JSON.parse(result.stdout);
  requireValid(!report.error, 'Audit registry returned an error');
  requireValid(
    Number.isInteger(report.metadata?.vulnerabilities?.total) &&
      result.status === (report.metadata.vulnerabilities.total > 0 ? 1 : 0),
    'Audit exit status contradicts report',
  );
  return report;
}

function developmentSummary(report, lockfile) {
  const findings = Object.entries(report.vulnerabilities)
    .filter(([, entry]) =>
      entry.nodes.every((node) => lockfile.packages[node].dev === true),
    )
    .map(([name, entry]) => ({
      package: name,
      severity: entry.severity,
      versions: [
        ...new Set(entry.nodes.map((node) => lockfile.packages[node].version)),
      ],
      paths: entry.nodes,
    }));
  const counts = Object.fromEntries(
    severities.map((severity) => [severity, 0]),
  );
  for (const finding of findings) counts[finding.severity]++;
  return { blocking: false, counts, findings };
}

function runAudit({
  root = resolve(__dirname, '../..'),
  runner = spawnSync,
  npmPath = process.env.npm_execpath,
  now = Date.now(),
} = {}) {
  const output = join(root, '.release-check/dependency-audit');
  mkdirSync(output, { recursive: true });
  const decision = {
    passed: false,
    production: null,
    development: null,
    errors: [],
  };
  let policy;
  let lockfile;
  try {
    policy = JSON.parse(
      readFileSync(
        join(root, 'security/dependency-audit-exceptions.json'),
        'utf8',
      ),
    );
    validateExceptions(policy, now);
    lockfile = JSON.parse(
      readFileSync(join(root, 'package-lock.json'), 'utf8'),
    );
  } catch (error) {
    decision.errors.push(`Policy/lockfile: ${error.message}`);
  }

  for (const scope of ['production', 'full']) {
    const reportPath = join(output, `${scope}-audit.json`);
    // Replace old evidence even when npm cannot start or returns no JSON.
    writeFileSync(
      reportPath,
      JSON.stringify({ error: 'Audit did not complete' }) + '\n',
    );
    try {
      requireValid(npmPath, 'Run this gate using npm run security:audit');
      const result = runner(
        process.execPath,
        [
          npmPath,
          'audit',
          scope === 'production' ? '--omit=dev' : '--include=dev',
          '--json',
          '--audit-level=info',
        ],
        {
          cwd: root,
          encoding: 'utf8',
          timeout: 120_000,
          maxBuffer: 10 * 1024 * 1024,
        },
      );
      writeFileSync(
        reportPath,
        result.stdout || JSON.stringify({ error: 'Audit output unavailable' }),
      );
      const report = readAuditResult(result);
      if (scope === 'production') {
        decision.production = evaluateAudit(report, policy, lockfile, now);
      } else {
        // Validate the full report equally strictly, but do not gate on its findings.
        evaluateAudit(report, { version: 1, exceptions: [] }, lockfile, now);
        decision.development = developmentSummary(report, lockfile);
      }
    } catch (error) {
      decision.errors.push(`${scope}: ${error.message}`);
    }
  }

  decision.passed =
    decision.errors.length === 0 &&
    decision.production?.passed === true &&
    decision.development !== null;
  writeFileSync(
    join(output, 'result.json'),
    JSON.stringify(decision, null, 2) + '\n',
  );
  const summary = [
    '# Dependency security',
    '',
    `Gate: **${decision.passed ? 'passed' : 'BLOCKED'}**. Production critical findings require exact, unexpired exceptions; all other severities are reported.`,
    '',
    '## Production findings',
    ...(decision.production?.findings ?? []).map(
      (finding) =>
        `- ${finding.exception ? 'EXCEPTED' : blocking.has(finding.severity) ? 'BLOCKED' : 'REPORTED'} ${finding.severity}: ${finding.advisory} ${finding.package}@${finding.version}`,
    ),
    ...(decision.production?.findings.length === 0
      ? ['No production advisories. See the raw report for lower severities.']
      : []),
    '',
    '## Development-only findings (nonblocking)',
    ...(decision.development?.findings ?? []).map(
      (finding) =>
        `- ${finding.severity}: ${finding.package}@${finding.versions.join(', ')}`,
    ),
    ...(decision.development?.findings.length === 0
      ? ['No development-only package findings.']
      : []),
    '',
    ...decision.errors.map((error) => `- Evidence error: ${error}`),
    '',
    'Full-tree evidence also contains production/mixed-scope packages. Findings do not block merely because they occur only in development; missing or invalid audit evidence does block.',
    '',
  ].join('\n');
  writeFileSync(join(output, 'summary.md'), summary);
  return { ...decision, summary };
}

if (require.main === module) {
  const decision = runAudit();
  console.log(decision.summary);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, decision.summary);
  if (!decision.passed) process.exitCode = 1;
}

module.exports = {
  validateExceptions,
  evaluateAudit,
  readAuditResult,
  developmentSummary,
  runAudit,
};
