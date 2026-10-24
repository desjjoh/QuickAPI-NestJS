'use strict';

const { test: nodeTest } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  evaluateAudit,
  readAuditResult,
  validateExceptions,
  runAudit,
} = require('./dependency-audit.cjs');

const now = Date.parse('2026-10-24T12:00:00Z');
const emptyPolicy = { version: 1, exceptions: [] };
const advisory = 'GHSA-abcd-1234-5678';
const lockfile = {
  lockfileVersion: 3,
  packages: {
    '': { name: 'fixture', version: '1.0.0' },
    'node_modules/runtime': { version: '1.2.3' },
    'node_modules/parent': { version: '2.0.0' },
    'node_modules/tool': { version: '3.0.0', dev: true },
  },
};

function vulnerability(name = 'runtime', severity = 'critical') {
  return {
    name,
    severity,
    via: [{ name, severity, url: `https://github.com/advisories/${advisory}` }],
    nodes: [`node_modules/${name}`],
  };
}

function report(vulnerabilities = {}) {
  const counts = {
    info: 0,
    low: 0,
    moderate: 0,
    high: 0,
    critical: 0,
    total: 0,
  };
  for (const entry of Object.values(vulnerabilities)) {
    counts[entry.severity]++;
    counts.total++;
  }
  return {
    auditReportVersion: 2,
    vulnerabilities,
    metadata: {
      vulnerabilities: counts,
      dependencies: {
        prod: 2,
        dev: 1,
        optional: 0,
        peer: 0,
        peerOptional: 0,
        total: 3,
      },
    },
  };
}

function exception(overrides = {}) {
  return {
    advisory,
    package: 'runtime',
    versions: ['1.2.3'],
    owner: 'security-owner',
    justification: 'Reviewed mitigation and scheduled compatible update',
    expires: '2026-11-01T00:00:00Z',
    ...overrides,
  };
}

function auditResult(value) {
  return {
    status: value.metadata.vulnerabilities.total > 0 ? 1 : 0,
    stdout: JSON.stringify(value),
  };
}

nodeTest(
  'clean production evidence passes; high/moderate/low findings remain nonblocking',
  () => {
    assert.equal(
      evaluateAudit(report(), emptyPolicy, lockfile, now).passed,
      true,
    );
    for (const severity of ['low', 'moderate', 'high']) {
      const result = evaluateAudit(
        report({ runtime: vulnerability('runtime', severity) }),
        emptyPolicy,
        lockfile,
        now,
      );
      assert.equal(result.passed, true);
      assert.equal(result.counts[severity], 1);
    }
  },
);

nodeTest(
  'only critical findings block, whether or not npm offers a fix',
  () => {
    for (const severity of ['high', 'critical']) {
      const entry = {
        ...vulnerability('runtime', severity),
        fixAvailable: false,
      };
      const result = evaluateAudit(
        report({ runtime: entry }),
        emptyPolicy,
        lockfile,
        now,
      );
      assert.equal(result.passed, severity !== 'critical');
      assert.equal(result.findings[0].exception, null);
    }
  },
);

nodeTest('valid exceptions retain matching findings in the decision', () => {
  const policy = { version: 1, exceptions: [exception()] };
  const result = evaluateAudit(
    report({ runtime: vulnerability() }),
    policy,
    lockfile,
    now,
  );
  assert.equal(result.passed, true);
  assert.deepEqual(result.findings[0].exception, policy.exceptions[0]);
});

nodeTest(
  'exceptions do not cover a different advisory, package, or version',
  () => {
    for (const change of [
      { advisory: 'GHSA-9999-9999-9999' },
      { package: 'parent' },
      { versions: ['1.2.4'] },
    ]) {
      assert.throws(
        () =>
          evaluateAudit(
            report({ runtime: vulnerability() }),
            { version: 1, exceptions: [exception(change)] },
            lockfile,
            now,
          ),
        /Unused exception/,
      );
    }
  },
);

nodeTest('all installed vulnerable versions require coverage', () => {
  const multi = structuredClone(lockfile);
  multi.packages['node_modules/parent/node_modules/runtime'] = {
    version: '1.2.4',
  };
  const entry = vulnerability();
  entry.nodes.push('node_modules/parent/node_modules/runtime');
  const result = evaluateAudit(
    report({ runtime: entry }),
    { version: 1, exceptions: [exception()] },
    multi,
    now,
  );
  assert.equal(result.passed, false);
  assert.equal(result.findings.length, 2);
});

nodeTest(
  'malformed, expired, duplicate, wildcard, and overlong exceptions fail',
  () => {
    for (const change of [
      { owner: '' },
      { justification: '' },
      { package: '*' },
      { versions: ['^1.2.3'] },
      { expires: '2026-10-24T12:00:00Z' },
      { expires: '2026-12-01T00:00:00Z' },
      { expires: 'invalid' },
      { advisory: 'CVE-UNKNOWN' },
      { unexpected: true },
    ]) {
      assert.throws(() =>
        validateExceptions(
          { version: 1, exceptions: [exception(change)] },
          now,
        ),
      );
    }
    assert.throws(
      () =>
        validateExceptions(
          { version: 1, exceptions: [exception(), exception()] },
          now,
        ),
      /Duplicate/,
    );
    assert.throws(
      () =>
        evaluateAudit(
          report(),
          { version: 1, exceptions: [exception()] },
          lockfile,
          now,
        ),
      /Unused/,
    );
  },
);

nodeTest(
  'transitive blocking chains lead to a real advisory; cycles cannot pass',
  () => {
    const transitive = { ...vulnerability('parent'), via: ['runtime'] };
    const result = evaluateAudit(
      report({ parent: transitive, runtime: vulnerability() }),
      emptyPolicy,
      lockfile,
      now,
    );
    assert.equal(result.passed, false);
    assert.equal(result.findings.length, 1);
    assert.throws(
      () =>
        evaluateAudit(
          report({ parent: { ...transitive, via: ['parent'] } }),
          emptyPolicy,
          lockfile,
          now,
        ),
      /Unresolved blocking/,
    );
    assert.throws(
      () =>
        evaluateAudit(
          report({ parent: transitive }),
          emptyPolicy,
          lockfile,
          now,
        ),
      /Missing transitive/,
    );
  },
);

nodeTest(
  'missing lock evidence, malformed reports, and inconsistent counts fail closed',
  () => {
    const cases = [
      {},
      { ...report(), auditReportVersion: 3 },
      { ...report(), error: {} },
      { ...report(), metadata: { vulnerabilities: {}, dependencies: {} } },
      report({ runtime: { ...vulnerability(), nodes: [] } }),
      report({
        runtime: { ...vulnerability(), nodes: ['node_modules/missing'] },
      }),
      {
        ...report(),
        metadata: {
          ...report().metadata,
          vulnerabilities: { ...report().metadata.vulnerabilities, high: 1 },
        },
      },
    ];
    for (const value of cases)
      assert.throws(() => evaluateAudit(value, emptyPolicy, lockfile, now));
    assert.throws(() => evaluateAudit(report(), emptyPolicy, {}, now));
  },
);

nodeTest(
  'unavailable commands, registry errors, invalid JSON, and contradictory exits fail',
  () => {
    for (const value of [
      { status: null, error: new Error('unavailable') },
      { status: null, signal: 'SIGTERM' },
      { status: 2, stdout: '{}' },
      { status: 0, stdout: '' },
      { status: 0, stdout: 'not-json' },
      { status: 0, stdout: '{"error":{"code":"E503"}}' },
      {
        status: 0,
        stdout: JSON.stringify(report({ runtime: vulnerability() })),
      },
      { status: 1, stdout: JSON.stringify(report()) },
    ])
      assert.throws(() => readAuditResult(value));
    assert.deepEqual(readAuditResult(auditResult(report())), report());
  },
);

function withFixture(callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nest-dependency-audit-'));
  try {
    fs.mkdirSync(path.join(root, 'security'));
    fs.writeFileSync(
      path.join(root, 'security/dependency-audit-exceptions.json'),
      JSON.stringify(emptyPolicy),
    );
    fs.writeFileSync(
      path.join(root, 'package-lock.json'),
      JSON.stringify(lockfile),
    );
    callback(root);
  } finally {
    assert.equal(path.dirname(root), os.tmpdir());
    fs.rmSync(root, { recursive: true, force: true });
  }
}

nodeTest(
  'orchestration retains production and dev-only reports; development findings do not block',
  () =>
    withFixture((root) => {
      const calls = [];
      const result = runAudit({
        root,
        now,
        npmPath: 'npm-cli.js',
        runner: (_exe, args) => {
          calls.push(args);
          return auditResult(
            args.includes('--omit=dev')
              ? report()
              : report({ tool: vulnerability('tool', 'moderate') }),
          );
        },
      });
      assert.equal(result.passed, true);
      assert.equal(result.development.counts.moderate, 1);
      assert.deepEqual(
        calls.map((args) => args[2]),
        ['--omit=dev', '--include=dev'],
      );
      const output = path.join(root, '.release-check/dependency-audit');
      for (const file of [
        'production-audit.json',
        'full-audit.json',
        'result.json',
        'summary.md',
      ])
        assert.ok(fs.existsSync(path.join(output, file)));
    }),
);

nodeTest(
  'production findings and failed full-tree evidence prevent approval',
  () =>
    withFixture((root) => {
      let result = runAudit({
        root,
        now,
        npmPath: 'npm-cli.js',
        runner: () => auditResult(report({ runtime: vulnerability() })),
      });
      assert.equal(result.passed, false);
      assert.equal(result.development.findings.length, 0);
      result = runAudit({
        root,
        now,
        npmPath: 'npm-cli.js',
        runner: (_exe, args) =>
          args.includes('--omit=dev') ? auditResult(report()) : { status: 2 },
      });
      assert.equal(result.passed, false);
      assert.match(result.errors.join(), /full: Audit command failed/);
    }),
);

nodeTest('command failure replaces stale evidence and cannot be excepted', () =>
  withFixture((root) => {
    runAudit({
      root,
      now,
      npmPath: 'npm-cli.js',
      runner: () => auditResult(report()),
    });
    const result = runAudit({
      root,
      now,
      npmPath: 'npm-cli.js',
      runner: () => {
        throw new Error('spawn failed');
      },
    });
    assert.equal(result.passed, false);
    assert.equal(result.errors.length, 2);
    assert.match(
      fs.readFileSync(
        path.join(
          root,
          '.release-check/dependency-audit/production-audit.json',
        ),
        'utf8',
      ),
      /did not complete/,
    );
  }),
);

for (const severity of ['high', 'critical']) {
  nodeTest(
    `development-only ${severity} advisories do not block clean production evidence`,
    () =>
      withFixture((root) => {
        const result = runAudit({
          root,
          now,
          npmPath: 'npm-cli.js',
          runner: (_exe, args) =>
            auditResult(
              args.includes('--omit=dev')
                ? report()
                : report({ tool: vulnerability('tool', severity) }),
            ),
        });
        assert.equal(result.passed, true);
        assert.equal(result.development.counts[severity], 1);
      }),
  );
}
