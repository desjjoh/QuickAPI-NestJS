'use strict';

const { test: nodeTest } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nodeCrypto = require('node:crypto');
const { run, inspectCandidate, verify } = require('./release-check.cjs');
const { publish } = require('./release-publish.cjs');

delete process.env.GITHUB_OUTPUT;
delete process.env.GITHUB_STEP_SUMMARY;

nodeTest(
  'OCI publication preserves digest and attestations in an isolated disposable registry',
  { skip: process.env.RELEASE_REGISTRY_TEST !== 'true', timeout: 120000 },
  async () => {
    const archive = path.resolve(process.env.RELEASE_TEST_ARCHIVE || '');
    const evidence = path.resolve(process.env.RELEASE_TEST_EVIDENCE || '');
    assert.ok(
      process.env.RELEASE_TEST_ARCHIVE && process.env.RELEASE_TEST_EVIDENCE,
      'Provide a successfully scanned candidate and evidence directory',
    );
    const digest = await verify(archive, evidence);
    const info = inspectCandidate(archive);
    const suffix = nodeCrypto.randomUUID().slice(0, 8);
    const network = `quickapi-release-test-${suffix}`;
    const registry = `quickapi-release-registry-${suffix}`;
    let networkId;
    let containerId;
    run('docker', ['pull', 'registry:2']);
    run('docker', ['pull', 'ghcr.io/regclient/regctl:latest']);
    const helperId = run(
      'docker',
      [
        'image',
        'inspect',
        '--format',
        '{{.Id}}',
        'ghcr.io/regclient/regctl:latest',
      ],
      true,
    );
    const config = path.join(
      path.dirname(archive),
      `registry-auth-${suffix}.json`,
    );
    fs.writeFileSync(config, JSON.stringify({ auths: {} }));
    const image = `${registry}:5000/quickapi-test`;
    const runner = (command, args, capture) => {
      if (command === 'docker' && args[0] === 'run') {
        args = [...args];
        const helper = args.indexOf(helperId);
        assert.ok(helper > 0);
        args.splice(
          helper + 1,
          0,
          '--host',
          `reg=${registry}:5000,tls=disabled`,
        );
        args.splice(1, 0, '--network', network);
      }
      return run(command, args, capture);
    };
    try {
      networkId = run(
        'docker',
        ['network', 'create', '--internal', network],
        true,
      );
      containerId = run(
        'docker',
        [
          'run',
          '--detach',
          '--rm',
          '--name',
          registry,
          '--network',
          network,
          'registry:2',
        ],
        true,
      );
      for (let attempt = 0; attempt < 20; attempt++) {
        if (run('docker', ['logs', containerId], true).includes('listening on'))
          break;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      await publish(archive, evidence, {
        image,
        tags: [`${image}:commit`, `${image}:version`],
        expectedDigest: digest,
        dockerConfig: config,
        runner,
      });
      const manifest = JSON.parse(
        runner(
          'docker',
          [
            'run',
            '--rm',
            helperId,
            'manifest',
            'get',
            `${image}@${digest}`,
            '--format',
            'raw-body',
          ],
          true,
        ),
      );
      assert.equal(manifest.manifests.length, 2);
      assert.equal(
        manifest.manifests.filter(
          (item) =>
            item.annotations?.['vnd.docker.reference.type'] ===
            'attestation-manifest',
        ).length,
        1,
      );
      const descriptor = manifest.manifests.find(
        (item) =>
          item.annotations?.['vnd.docker.reference.type'] ===
          'attestation-manifest',
      );
      const attestation = JSON.parse(
        runner(
          'docker',
          [
            'run',
            '--rm',
            helperId,
            'manifest',
            'get',
            `${image}@${descriptor.digest}`,
            '--format',
            'raw-body',
          ],
          true,
        ),
      );
      const predicates = [];
      for (const layer of attestation.layers) {
        const statement = JSON.parse(
          runner(
            'docker',
            ['run', '--rm', helperId, 'blob', 'get', image, layer.digest],
            true,
          ),
        );
        predicates.push(statement.predicateType);
      }
      assert.ok(predicates.includes('https://spdx.dev/Document'));
      assert.ok(
        predicates.some((value) =>
          value.startsWith('https://slsa.dev/provenance/'),
        ),
      );
      assert.ok(info.sbom && info.provenance);
      assert.equal(
        runner(
          'docker',
          ['run', '--rm', helperId, 'image', 'digest', `${image}:version`],
          true,
        ),
        digest,
      );
    } finally {
      // IDs identify only resources created by this test; no host ports or volumes.
      if (containerId && /^[a-f\d]{64}$/.test(containerId))
        run('docker', ['rm', '--force', containerId]);
      if (networkId && /^[a-f\d]{64}$/.test(networkId))
        run('docker', ['network', 'rm', networkId]);
    }
  },
);
