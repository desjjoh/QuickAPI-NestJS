'use strict';

const fs = require('node:fs');
const path = require('node:path');
const nodeCrypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const policyPath = path.resolve(
  __dirname,
  '../../security/container-vulnerability-exceptions.json',
);
const scannerDefault = 'aquasec/trivy:latest';
const severities = new Set(['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}
function text(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048)
    throw new Error(`${label} must be a bounded non-empty string`);
  return value;
}
function key(value) {
  return JSON.stringify([
    value.vulnerabilityId,
    value.packageName,
    value.installedVersion,
    value.packagePath,
    value.target,
    value.type,
  ]);
}
function evaluate(report, policy, now = new Date()) {
  object(report, 'scan report');
  if (
    report.SchemaVersion !== 2 ||
    report.ArtifactType !== 'container_image' ||
    !Array.isArray(report.Results)
  )
    throw new Error('Unsupported or incomplete Trivy image report');
  const metadata = object(report.Metadata, 'image metadata');
  text(metadata.ImageID, 'image ID');
  const os = object(metadata.OS, 'detected image OS');
  text(os.Family, 'OS family');
  text(os.Name, 'OS version');
  if (!report.Results.some((result) => result.Class === 'os-pkgs'))
    throw new Error('Image OS packages were not scanned');
  if (
    !report.Results.some(
      (result) => result.Class === 'lang-pkgs' && result.Type === 'node-pkg',
    )
  )
    throw new Error('Node packages were not scanned');
  if (os.EOSL === true || os.Family === 'unknown')
    throw new Error('Image OS is unsupported or end-of-life');
  object(policy, 'exception policy');
  if (policy.version !== 1 || !Array.isArray(policy.exceptions))
    throw new Error('Unsupported exception policy');
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()))
    throw new Error('Invalid gate clock');
  const rules = new Map();
  for (const entry of policy.exceptions) {
    object(entry, 'exception');
    for (const field of [
      'vulnerabilityId',
      'packageName',
      'installedVersion',
      'target',
      'type',
      'owner',
      'reason',
      'review',
    ]) {
      text(entry[field], `exception ${field}`);
      if (
        [
          'vulnerabilityId',
          'packageName',
          'installedVersion',
          'target',
          'type',
        ].includes(field) &&
        entry[field].includes('*')
      )
        throw new Error('Exception scopes cannot contain wildcards');
    }
    if (entry.packagePath !== null) {
      text(entry.packagePath, 'exception packagePath');
      if (entry.packagePath.includes('*'))
        throw new Error('Exception scopes cannot contain wildcards');
    }
    if (
      typeof entry.expiresOn !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(entry.expiresOn)
    )
      throw new Error('Invalid exception expiry');
    const expiry = new Date(`${entry.expiresOn}T00:00:00.000Z`);
    if (
      !Number.isFinite(expiry.getTime()) ||
      expiry.toISOString().slice(0, 10) !== entry.expiresOn
    )
      throw new Error('Invalid exception expiry');
    if (rules.has(key(entry))) throw new Error('Duplicate exception scope');
    rules.set(key(entry), { ...entry, expired: expiry <= now });
  }
  const findings = [];
  for (const result of report.Results) {
    object(result, 'scan result');
    text(result.Target, 'result target');
    text(result.Type, 'result type');
    if (
      result.Vulnerabilities !== undefined &&
      !Array.isArray(result.Vulnerabilities)
    )
      throw new Error('Malformed vulnerability list');
    for (const vulnerability of result.Vulnerabilities ?? []) {
      object(vulnerability, 'vulnerability');
      for (const field of ['VulnerabilityID', 'PkgName', 'InstalledVersion'])
        text(vulnerability[field], field);
      if (!severities.has(vulnerability.Severity))
        throw new Error('Invalid vulnerability severity');
      const finding = {
        vulnerabilityId: vulnerability.VulnerabilityID,
        packageName: vulnerability.PkgName,
        installedVersion: vulnerability.InstalledVersion,
        target: result.Target,
        type: result.Type,
        packagePath: vulnerability.PkgPath ?? null,
        severity: vulnerability.Severity,
        fixedVersion: vulnerability.FixedVersion ?? null,
      };
      if (finding.packagePath !== null)
        text(finding.packagePath, 'package path');
      const exception = rules.get(key(finding));
      findings.push({
        ...finding,
        exception: exception && !exception.expired ? exception : null,
      });
    }
  }
  const blocked = findings.filter(
    (finding) => finding.severity === 'CRITICAL' && !finding.exception,
  );
  return {
    allowed: blocked.length === 0,
    blocked,
    findings,
    expiredExceptions: [...rules.values()].filter((rule) => rule.expired),
    evaluatedAt: now.toISOString(),
  };
}

function run(command, args, capture = false) {
  const result = spawnSync(command, args, {
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `${command} failed${result.status === null ? '' : ` (exit ${result.status})`}${capture ? `: ${result.stderr?.trim() ?? ''}` : ''}`,
    );
  return capture ? result.stdout.trim() : '';
}
function readTarEntry(filename, wanted) {
  const fd = fs.openSync(filename, 'r');
  try {
    const header = Buffer.alloc(512);
    let offset = 0;
    while (
      fs.readSync(fd, header, 0, 512, offset) === 512 &&
      header.some((byte) => byte !== 0)
    ) {
      const string = (start, size) =>
        header
          .subarray(start, start + size)
          .toString('utf8')
          .split('\0')[0];
      const prefix = string(345, 155);
      const name = `${prefix ? `${prefix}/` : ''}${string(0, 100)}`.replace(
        /^\.\//,
        '',
      );
      const sizeText = string(124, 12).trim();
      if (!/^[0-7]+$/.test(sizeText))
        throw new Error('Unsupported OCI tar size');
      const size = Number.parseInt(sizeText, 8);
      if (name === wanted) {
        if (size > 16 * 1024 * 1024)
          throw new Error('OCI metadata is too large');
        const body = Buffer.alloc(size);
        if (fs.readSync(fd, body, 0, size, offset + 512) !== size)
          throw new Error('Truncated OCI metadata');
        return body;
      }
      offset += 512 + Math.ceil(size / 512) * 512;
    }
    throw new Error(`OCI archive lacks ${wanted}`);
  } finally {
    fs.closeSync(fd);
  }
}
function candidateDigest(archive) {
  const index = JSON.parse(
    readTarEntry(archive, 'index.json').toString('utf8'),
  );
  if (
    index.schemaVersion !== 2 ||
    !Array.isArray(index.manifests) ||
    index.manifests.length !== 1
  )
    throw new Error('Expected exactly one OCI release candidate');
  const digest = index.manifests[0].digest;
  if (typeof digest !== 'string' || !/^sha256:[a-f\d]{64}$/.test(digest))
    throw new Error('Invalid candidate digest');
  const content = readTarEntry(archive, `blobs/sha256/${digest.slice(7)}`);
  if (
    `sha256:${nodeCrypto.createHash('sha256').update(content).digest('hex')}` !==
    digest
  )
    throw new Error('Candidate manifest digest mismatch');
  return digest;
}
function inspectCandidate(archive) {
  const digest = candidateDigest(archive);
  const readBlob = (reference) => {
    if (
      typeof reference !== 'string' ||
      !/^sha256:[a-f\d]{64}$/.test(reference)
    )
      throw new Error('Invalid OCI blob digest');
    const content = readTarEntry(archive, `blobs/sha256/${reference.slice(7)}`);
    if (
      `sha256:${nodeCrypto.createHash('sha256').update(content).digest('hex')}` !==
      reference
    )
      throw new Error('OCI metadata digest mismatch');
    return JSON.parse(content.toString('utf8'));
  };
  const index = readBlob(digest);
  if (!Array.isArray(index.manifests))
    throw new Error('Candidate must retain its OCI index and attestations');
  const runtime = index.manifests.filter(
    (item) => item.platform?.os !== 'unknown',
  );
  if (
    runtime.length !== 1 ||
    runtime[0].platform?.os !== 'linux' ||
    runtime[0].platform?.architecture !== 'amd64'
  )
    throw new Error('Gate scans exactly one linux/amd64 runtime image');
  const image = readBlob(runtime[0].digest);
  if (!/^sha256:[a-f\d]{64}$/.test(image.config?.digest ?? ''))
    throw new Error('Candidate lacks an image config digest');
  const attestations = {};
  for (const descriptor of index.manifests.filter(
    (item) =>
      item.annotations?.['vnd.docker.reference.type'] ===
      'attestation-manifest',
  )) {
    if (
      descriptor.annotations['vnd.docker.reference.digest'] !==
      runtime[0].digest
    )
      throw new Error('Attestation is not bound to the scanned runtime');
    for (const layer of readBlob(descriptor.digest).layers ?? []) {
      const predicate = layer.annotations?.['in-toto.io/predicate-type'];
      if (predicate === 'https://spdx.dev/Document')
        attestations.sbom = readBlob(layer.digest);
      if (
        [
          'https://slsa.dev/provenance/v0.2',
          'https://slsa.dev/provenance/v1',
        ].includes(predicate)
      )
        attestations.provenance = readBlob(layer.digest);
    }
  }
  if (!attestations.sbom || !attestations.provenance)
    throw new Error(
      'Candidate must include SPDX SBOM and provenance attestations',
    );
  return { digest, imageId: image.config.digest, ...attestations };
}
async function hashFile(filename) {
  const hash = nodeCrypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
}
async function scan(
  archive,
  output,
  { scanner = scannerDefault, runner = run } = {},
) {
  fs.mkdirSync(output, { recursive: true });
  const reportPath = path.join(output, 'vulnerabilities.json');
  if (
    fs.existsSync(reportPath) ||
    fs.existsSync(path.join(output, 'gate.json'))
  )
    throw new Error(
      'Use a fresh evidence directory; existing scan evidence cannot be reused',
    );
  const candidateInfo = inspectCandidate(archive);
  const digest = candidateInfo.digest;
  const archiveHash = await hashFile(archive);
  runner('docker', ['pull', scanner]);
  const scannerId = runner(
    'docker',
    ['image', 'inspect', '--format', '{{.Id}}', scanner],
    true,
  );
  const cache = path.resolve(
    process.env.RELEASE_SCAN_CACHE || '.release-check/trivy-cache',
  );
  fs.mkdirSync(cache, { recursive: true });
  const mount = [
    'run',
    '--rm',
    '--mount',
    `type=bind,source=${output},target=/evidence`,
    '--mount',
    `type=bind,source=${cache},target=/root/.cache/trivy`,
  ];
  const scannerVersion = runner(
    'docker',
    ['run', '--rm', scannerId, '--version'],
    true,
  );
  // Trivy reads Docker tar archives or OCI layout directories, not OCI tar
  // archives. Unpack with the scanner's own tar utility in an isolated container.
  const layout = path.join(
    path.dirname(archive),
    `scan-layout-${nodeCrypto.randomUUID()}`,
  );
  const target = path.resolve(layout);
  if (
    path.dirname(target) !== path.resolve(path.dirname(archive)) ||
    !/^scan-layout-[a-f\d-]{36}$/.test(path.basename(target))
  )
    throw new Error('Unsafe scratch cleanup path');
  fs.mkdirSync(layout);
  try {
    const extractUser =
      typeof process.getuid === 'function'
        ? `${process.getuid()}:${process.getgid()}`
        : '0:0';
    runner('docker', [
      'run',
      '--rm',
      '--user',
      extractUser,
      '--network',
      'none',
      '--entrypoint',
      'tar',
      '--mount',
      `type=bind,source=${archive},target=/archive/image.tar,readonly`,
      '--mount',
      `type=bind,source=${layout},target=/layout`,
      scannerId,
      '--no-same-owner',
      '-xf',
      '/archive/image.tar',
      '-C',
      '/layout',
    ]);
    if (
      !fs
        .readFileSync(path.join(layout, 'index.json'))
        .equals(readTarEntry(archive, 'index.json'))
    )
      throw new Error('Extracted OCI index differs from candidate');
    runner('docker', [
      ...mount,
      '--mount',
      `type=bind,source=${layout},target=/image,readonly`,
      scannerId,
      'image',
      '--input',
      '/image',
      '--scanners',
      'vuln',
      '--ignorefile',
      '/dev/null',
      '--format',
      'json',
      '--output',
      '/evidence/vulnerabilities.json',
      '--exit-code',
      '0',
    ]);
  } finally {
    // Delete only this run's newly created layout, never the input archive.
    fs.rmSync(target, { recursive: true, force: true });
  }
  if (archiveHash !== (await hashFile(archive)))
    throw new Error('Release candidate changed during scanning');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  if (report.Metadata?.ImageID !== candidateInfo.imageId)
    throw new Error('Scanner report does not identify the candidate runtime');
  const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  const gate = evaluate(report, policy);
  fs.writeFileSync(
    path.join(output, 'sbom.spdx.json'),
    JSON.stringify(candidateInfo.sbom.predicate, null, 2),
  );
  fs.writeFileSync(
    path.join(output, 'provenance.json'),
    JSON.stringify(candidateInfo.provenance, null, 2),
  );
  fs.writeFileSync(
    path.join(output, 'candidate.json'),
    JSON.stringify(
      {
        digest,
        archiveSha256: archiveHash,
        reportSha256: await hashFile(reportPath),
        scannerId,
        scannerVersion,
        policySha256: nodeCrypto
          .createHash('sha256')
          .update(fs.readFileSync(policyPath))
          .digest('hex'),
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(
    path.join(output, 'gate.json'),
    JSON.stringify(gate, null, 2),
  );
  // Conversion uses the pinned scanner instance, not a newly pulled tag.
  runner('docker', [
    'run',
    '--rm',
    '--mount',
    `type=bind,source=${output},target=/evidence`,
    scannerId,
    'convert',
    '--format',
    'sarif',
    '--output',
    '/evidence/vulnerabilities.sarif',
    '/evidence/vulnerabilities.json',
  ]);
  if (process.env.GITHUB_OUTPUT)
    fs.appendFileSync(process.env.GITHUB_OUTPUT, 'sarif=true\n');
  const lines = [
    '# Release vulnerability gate',
    '',
    `Candidate: \`${digest}\``,
    '',
    `Gate: **${gate.allowed ? 'PASS' : 'BLOCKED'}**`,
    '',
    `Critical blockers: ${gate.blocked.length}; total findings: ${gate.findings.length}.`,
    '',
    '| Severity | Vulnerability | Package | Installed | Fixed | Exception |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  const escape = (value) => String(value ?? 'none').replace(/[|\r\n`]/g, ' ');
  for (const finding of gate.findings.filter((item) =>
    ['HIGH', 'CRITICAL'].includes(item.severity),
  ))
    lines.push(
      `| ${[finding.severity, finding.vulnerabilityId, finding.packageName, finding.installedVersion, finding.fixedVersion, finding.exception ? `${finding.exception.owner}; expires ${finding.exception.expiresOn}` : 'none'].map(escape).join(' | ')} |`,
    );
  fs.writeFileSync(path.join(output, 'summary.md'), `${lines.join('\n')}\n`);
  if (process.env.GITHUB_STEP_SUMMARY)
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
  console.log(
    `Release gate ${gate.allowed ? 'passed' : 'BLOCKED'}; evidence: ${output}`,
  );
  if (!gate.allowed)
    throw new Error(
      `${gate.blocked.length} unexcepted critical finding(s) block publication`,
    );
  return gate;
}

async function verify(archive, output) {
  const candidate = object(
    JSON.parse(fs.readFileSync(path.join(output, 'candidate.json'), 'utf8')),
    'candidate evidence',
  );
  const policy = fs.readFileSync(policyPath);
  const reportPath = path.join(output, 'vulnerabilities.json');
  if (
    candidate.archiveSha256 !== (await hashFile(archive)) ||
    candidate.digest !== candidateDigest(archive)
  )
    throw new Error('Candidate does not match the scanned artifact');
  if (candidate.reportSha256 !== (await hashFile(reportPath)))
    throw new Error('Scan evidence changed');
  if (
    candidate.policySha256 !==
    nodeCrypto.createHash('sha256').update(policy).digest('hex')
  )
    throw new Error('Exception policy changed; rescan before publication');
  if (
    !evaluate(
      JSON.parse(fs.readFileSync(reportPath, 'utf8')),
      JSON.parse(policy),
    ).allowed
  )
    throw new Error(
      'Critical findings or expired exceptions block publication',
    );
  return candidate.digest;
}

async function main(args) {
  if (args[0] === 'scan' && args.length === 3)
    return scan(path.resolve(args[1]), path.resolve(args[2]), {
      scanner: process.env.TRIVY_SCANNER_IMAGE || scannerDefault,
    });
  if (args[0] === 'verify' && args.length === 3)
    return console.log(
      await verify(path.resolve(args[1]), path.resolve(args[2])),
    );
  if (args.length)
    throw new Error(
      'Usage: release-check.cjs [scan <OCI archive> <fresh evidence directory>]',
    );
  const output = path.resolve(
    '.release-check',
    `run-${Date.now()}-${nodeCrypto.randomUUID()}`,
  );
  fs.mkdirSync(output, { recursive: true });
  const archive = path.join(output, 'candidate.tar');
  // OCI keeps the runtime manifest and BuildKit provenance/SBOM attestations.
  run('docker', [
    'buildx',
    'build',
    '--pull',
    '--platform',
    'linux/amd64',
    '--provenance=mode=max',
    '--sbom=true',
    '--output',
    `type=oci,dest=${archive}`,
    '.',
  ]);
  return scan(archive, path.join(output, 'evidence'), {
    scanner: process.env.TRIVY_SCANNER_IMAGE || scannerDefault,
  });
}

module.exports = {
  evaluate,
  run,
  readTarEntry,
  candidateDigest,
  inspectCandidate,
  scan,
  verify,
  main,
};
if (require.main === module)
  main(process.argv.slice(2)).catch((error) => {
    console.error(`Release check failed: ${error.message}`);
    process.exitCode = 1;
  });
