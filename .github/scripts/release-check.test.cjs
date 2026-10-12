'use strict';

const { test: nodeTest } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const nodeCrypto = require('node:crypto');
const {
  evaluate,
  run,
  candidateDigest,
  inspectCandidate,
  scan,
  verify,
  main,
} = require('./release-check.cjs');
const { publish } = require('./release-publish.cjs');

// Synthetic fixtures must never append fake releases to CI step outputs.
delete process.env.GITHUB_OUTPUT;
delete process.env.GITHUB_STEP_SUMMARY;

const imageId = `sha256:${'a'.repeat(64)}`;
const emptyPolicy = { version: 1, exceptions: [] };
const now = new Date('2026-10-11T12:00:00Z');
const finding = (severity = 'CRITICAL', overrides = {}) => ({
  VulnerabilityID: 'CVE-2026-1234',
  PkgName: 'example',
  InstalledVersion: '1.0.0',
  PkgPath: 'usr/local/lib/node_modules/npm/node_modules/example/package.json',
  Severity: severity,
  ...overrides,
});
const report = (vulnerabilities = []) => ({
  SchemaVersion: 2,
  ArtifactType: 'container_image',
  Metadata: { ImageID: imageId, OS: { Family: 'alpine', Name: '3.24.2' } },
  Results: [
    { Target: '/image (alpine 3.24.2)', Class: 'os-pkgs', Type: 'alpine' },
    {
      Target: 'Node.js',
      Class: 'lang-pkgs',
      Type: 'node-pkg',
      Vulnerabilities: vulnerabilities,
    },
  ],
});
const exception = (overrides = {}) => ({
  vulnerabilityId: 'CVE-2026-1234',
  packageName: 'example',
  installedVersion: '1.0.0',
  packagePath: finding().PkgPath,
  target: 'Node.js',
  type: 'node-pkg',
  owner: 'reviewer',
  reason: 'reviewed impact and remediation plan',
  review: 'SEC-123',
  expiresOn: '2026-11-01',
  ...overrides,
});

nodeTest(
  'clean report passes and all noncritical findings remain visible',
  () => {
    assert.equal(evaluate(report(), emptyPolicy, now).allowed, true);
    const result = evaluate(
      report(
        ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'].map((value) => finding(value)),
      ),
      emptyPolicy,
      now,
    );
    assert.equal(result.allowed, true);
    assert.equal(result.findings.length, 4);
  },
);
for (const fixed of [undefined, '1.0.1'])
  nodeTest(
    `critical findings block even when fixed version is ${fixed}`,
    () => {
      const result = evaluate(
        report([finding('CRITICAL', { FixedVersion: fixed })]),
        emptyPolicy,
        now,
      );
      assert.equal(result.allowed, false);
      assert.equal(result.blocked.length, 1);
    },
  );
nodeTest('reviewed exceptions retain findings and match exact scope', () => {
  const result = evaluate(
    report([finding()]),
    { version: 1, exceptions: [exception()] },
    now,
  );
  assert.equal(result.allowed, true);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].exception.owner, 'reviewer');
});
for (const field of [
  'vulnerabilityId',
  'packageName',
  'installedVersion',
  'packagePath',
  'target',
  'type',
])
  nodeTest(`exceptions cannot exempt a different ${field}`, () => {
    const result = evaluate(
      report([finding()]),
      { version: 1, exceptions: [exception({ [field]: 'different' })] },
      now,
    );
    assert.equal(result.allowed, false);
  });
nodeTest(
  'expiry applies at the start of its UTC date, and stale entries cannot exempt findings',
  () => {
    const policy = {
      version: 1,
      exceptions: [exception({ expiresOn: '2026-10-11' })],
    };
    assert.equal(
      evaluate(report([finding()]), policy, new Date('2026-10-10T23:59:59Z'))
        .allowed,
      true,
    );
    const expired = evaluate(
      report([finding()]),
      policy,
      new Date('2026-10-11T00:00:00Z'),
    );
    assert.equal(expired.allowed, false);
    assert.equal(expired.expiredExceptions.length, 1);
    assert.equal(evaluate(report(), policy, now).allowed, true);
  },
);
for (const overrides of [
  { owner: '' },
  { review: '' },
  { reason: '' },
  { packagePath: undefined },
  { packagePath: '*' },
  { vulnerabilityId: '*' },
  { expiresOn: '2026-02-30' },
  { expiresOn: 'later' },
])
  nodeTest(
    `invalid exception fails closed: ${JSON.stringify(overrides)}`,
    () => {
      assert.throws(() =>
        evaluate(
          report(),
          { version: 1, exceptions: [exception(overrides)] },
          now,
        ),
      );
    },
  );
nodeTest('duplicate exception scopes fail closed', () =>
  assert.throws(
    () =>
      evaluate(
        report(),
        { version: 1, exceptions: [exception(), exception()] },
        now,
      ),
    /Duplicate/,
  ),
);
for (const value of [
  null,
  {},
  { ...report(), SchemaVersion: 1 },
  { ...report(), Results: null },
  { ...report(), Metadata: {} },
  { ...report(), Results: [report().Results[0]] },
  { ...report(), Results: [report().Results[1]] },
  report([finding('NOT_REAL')]),
  {
    ...report(),
    Metadata: {
      ImageID: imageId,
      OS: { Family: 'alpine', Name: '3.1', EOSL: true },
    },
  },
  report([finding('CRITICAL', { InstalledVersion: '' })]),
])
  nodeTest('malformed or incomplete scanner output cannot pass', () =>
    assert.throws(() => evaluate(value, emptyPolicy, now)),
  );

function archiveFixture(
  directory,
  { noProvenance = false, secondRuntime = false } = {},
) {
  const entries = [];
  const blob = (value) => {
    const body = Buffer.from(JSON.stringify(value));
    const digest = `sha256:${nodeCrypto.createHash('sha256').update(body).digest('hex')}`;
    entries.push([`blobs/sha256/${digest.slice(7)}`, body]);
    return digest;
  };
  const runtime = blob({
    schemaVersion: 2,
    config: { digest: imageId },
    layers: [],
  });
  const sbom = blob({
    predicate: { spdxVersion: 'SPDX-2.3', name: 'fixture' },
  });
  const provenance = blob({ predicate: { buildType: 'fixture' } });
  const layers = [
    {
      digest: sbom,
      annotations: { 'in-toto.io/predicate-type': 'https://spdx.dev/Document' },
    },
  ];
  if (!noProvenance)
    layers.push({
      digest: provenance,
      annotations: {
        'in-toto.io/predicate-type': 'https://slsa.dev/provenance/v1',
      },
    });
  const attestation = blob({ schemaVersion: 2, layers });
  const manifests = [
    { digest: runtime, platform: { os: 'linux', architecture: 'amd64' } },
    {
      digest: attestation,
      platform: { os: 'unknown', architecture: 'unknown' },
      annotations: {
        'vnd.docker.reference.type': 'attestation-manifest',
        'vnd.docker.reference.digest': runtime,
      },
    },
  ];
  if (secondRuntime)
    manifests.push({
      digest: runtime,
      platform: { os: 'linux', architecture: 'arm64' },
    });
  const digest = blob({ schemaVersion: 2, manifests });
  const index = Buffer.from(
    JSON.stringify({ schemaVersion: 2, manifests: [{ digest }] }),
  );
  entries.push(['index.json', index]);
  const tar = [];
  for (const [name, body] of entries) {
    const header = Buffer.alloc(512);
    header.write(name, 0, 100);
    header.write('0000644\0', 100, 8);
    header.write(`${body.length.toString(8).padStart(11, '0')}\0`, 124, 12);
    header.fill(32, 148, 156);
    header.write('0', 156);
    header.write('ustar\0', 257, 6);
    const sum = header.reduce((total, byte) => total + byte, 0);
    header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 8);
    tar.push(header, body, Buffer.alloc((512 - (body.length % 512)) % 512));
  }
  tar.push(Buffer.alloc(1024));
  const archive = path.join(directory, 'candidate.tar');
  fs.writeFileSync(archive, Buffer.concat(tar));
  return { archive, digest, index };
}
function temporary(t) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'quickapi-release-test-'),
  );
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}
function fakeScanner(fixture, output, vulnerabilities = [], failure = null) {
  const calls = [];
  const runner = (command, args) => {
    calls.push([command, args]);
    if (args.includes('--entrypoint')) {
      const layout = args
        .find((value) => value.includes('target=/layout'))
        .match(/source=(.*),target=/)[1];
      fs.writeFileSync(path.join(layout, 'index.json'), fixture.index);
    }
    if (args.includes('--version')) return 'Trivy fixture';
    if (args[0] === 'image' && args[1] === 'inspect')
      return `sha256:${'b'.repeat(64)}`;
    if (args.includes('--input')) {
      if (failure) throw new Error(failure);
      fs.writeFileSync(
        path.join(output, 'vulnerabilities.json'),
        JSON.stringify(report(vulnerabilities)),
      );
    }
    return '';
  };
  return { runner, calls };
}

nodeTest(
  'validates OCI digest, single-platform scan coverage, and both attestations',
  (t) => {
    const directory = temporary(t);
    const fixture = archiveFixture(directory);
    assert.equal(candidateDigest(fixture.archive), fixture.digest);
    assert.equal(inspectCandidate(fixture.archive).imageId, imageId);
    assert.throws(
      () =>
        inspectCandidate(
          archiveFixture(directory, { noProvenance: true }).archive,
        ),
      /provenance/,
    );
    assert.throws(
      () =>
        inspectCandidate(
          archiveFixture(directory, { secondRuntime: true }).archive,
        ),
      /exactly one/,
    );
  },
);
nodeTest(
  'complete scan passes without publication and records bound evidence/SBOM',
  async (t) => {
    const directory = temporary(t);
    const fixture = archiveFixture(directory);
    const output = path.join(directory, 'evidence');
    const fake = fakeScanner(fixture, output);
    await scan(fixture.archive, output, { runner: fake.runner });
    assert.equal(await verify(fixture.archive, output), fixture.digest);
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(output, 'sbom.spdx.json')))
        .spdxVersion,
      'SPDX-2.3',
    );
    const invocation = fake.calls.find(([, args]) =>
      args.includes('--input'),
    )[1];
    assert.equal(invocation.includes('--ignore-unfixed'), false);
    assert.equal(
      fake.calls.some(([, args]) => args.includes('push')),
      false,
    );
    await assert.rejects(
      scan(fixture.archive, output, { runner: fake.runner }),
      /fresh evidence/,
    );
  },
);
nodeTest(
  'scanner failure cannot yield passing gate evidence or publication',
  async (t) => {
    const directory = temporary(t);
    const fixture = archiveFixture(directory);
    const output = path.join(directory, 'evidence');
    const fake = fakeScanner(fixture, output, [], 'scanner unavailable');
    await assert.rejects(
      scan(fixture.archive, output, { runner: fake.runner }),
      /scanner unavailable/,
    );
    assert.equal(fs.existsSync(path.join(output, 'gate.json')), false);
  },
);
nodeTest(
  'critical scan retains reports before failing and publisher never runs',
  async (t) => {
    const directory = temporary(t);
    const fixture = archiveFixture(directory);
    const output = path.join(directory, 'evidence');
    await assert.rejects(
      scan(fixture.archive, output, {
        runner: fakeScanner(fixture, output, [finding()]).runner,
      }),
      /block publication/,
    );
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(output, 'gate.json'))).allowed,
      false,
    );
    let invoked = false;
    await assert.rejects(
      publish(fixture.archive, output, {
        runner: () => {
          invoked = true;
        },
      }),
      /block publication/,
    );
    assert.equal(invoked, false);
  },
);
for (const tamper of ['archive', 'report'])
  nodeTest(`changed ${tamper} cannot be published`, async (t) => {
    const directory = temporary(t);
    const fixture = archiveFixture(directory);
    const output = path.join(directory, 'evidence');
    await scan(fixture.archive, output, {
      runner: fakeScanner(fixture, output).runner,
    });
    fs.appendFileSync(
      tamper === 'archive'
        ? fixture.archive
        : path.join(output, 'vulnerabilities.json'),
      ' ',
    );
    await assert.rejects(
      verify(fixture.archive, output),
      /changed|does not match/,
    );
  });
nodeTest(
  'publication imports only the approved archive and copies tags by its immutable digest',
  async (t) => {
    const directory = temporary(t);
    const fixture = archiveFixture(directory);
    const output = path.join(directory, 'evidence');
    await scan(fixture.archive, output, {
      runner: fakeScanner(fixture, output).runner,
    });
    const dockerConfig = path.join(directory, 'docker-config.json');
    fs.writeFileSync(dockerConfig, '{}');
    const calls = [];
    const runner = (command, args) => {
      calls.push([command, args]);
      return args.includes('inspect')
        ? `sha256:${'c'.repeat(64)}`
        : args.includes('digest')
          ? fixture.digest
          : '';
    };
    await publish(fixture.archive, output, {
      image: 'registry.test/quickapi',
      tags: ['registry.test/quickapi:commit', 'registry.test/quickapi:1.3.0'],
      expectedDigest: fixture.digest,
      dockerConfig,
      runner,
    });
    assert.equal(calls.filter(([, args]) => args.includes('import')).length, 1);
    assert.equal(
      calls.some(([, args]) =>
        args.includes(`${'registry.test/quickapi'}@${fixture.digest}`),
      ),
      true,
    );
    assert.equal(
      calls.some(([, args]) => args.includes('build')),
      false,
    );
    assert.match(
      fs.readFileSync(path.join(output, 'release-image.env'), 'utf8'),
      new RegExp(fixture.digest),
    );
    let invoked = false;
    await assert.rejects(
      publish(fixture.archive, output, {
        expectedDigest: `sha256:${'d'.repeat(64)}`,
        runner: () => {
          invoked = true;
        },
      }),
      /digests differ/,
    );
    assert.equal(invoked, false);
  },
);
nodeTest(
  'registry digest mismatch prevents deployment reference and subsequent tags',
  async (t) => {
    const directory = temporary(t);
    const fixture = archiveFixture(directory);
    const output = path.join(directory, 'evidence');
    await scan(fixture.archive, output, {
      runner: fakeScanner(fixture, output).runner,
    });
    const dockerConfig = path.join(directory, 'docker-config.json');
    fs.writeFileSync(dockerConfig, '{}');
    await assert.rejects(
      publish(fixture.archive, output, {
        image: 'registry.test/app',
        tags: ['registry.test/app:sha'],
        expectedDigest: fixture.digest,
        dockerConfig,
        runner: () => 'different',
      }),
      /changed the approved/,
    );
    assert.equal(fs.existsSync(path.join(output, 'release-image.env')), false);
  },
);
nodeTest('process failures fail closed', () => {
  assert.throws(
    () => run(process.execPath, ['-e', 'process.exit(2)']),
    /exit 2/,
  );
});
nodeTest('unknown CLI modes fail before any Docker operation', async () => {
  await assert.rejects(main(['unknown']), /Usage/);
});
nodeTest(
  'workflow keeps publishing after the shared scan, without a second build or broad suppressions',
  () => {
    const workflow = fs.readFileSync(
      path.resolve(__dirname, '../workflows/release-image.yml'),
      'utf8',
    );
    assert.equal(
      (workflow.match(/docker\/build-push-action/g) ?? []).length,
      1,
    );
    assert.match(workflow, /push: false/);
    assert.match(workflow, /provenance: mode=max/);
    assert.match(workflow, /sbom: true/);
    assert.ok(
      workflow.indexOf('release-check.cjs scan') <
        workflow.indexOf('docker/login-action'),
    );
    assert.ok(
      workflow.indexOf('release-check.cjs scan') <
        workflow.indexOf('release-publish.cjs'),
    );
    assert.equal(workflow.includes('--ignore-unfixed'), false);
  },
);
