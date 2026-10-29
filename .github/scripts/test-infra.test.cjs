'use strict';
const nodeTest = require('node:test');
const assert = require('node:assert/strict');
const { runTask, assertLocalInfrastructure } = require('./test-infra.cjs');

function runner(results = []) {
  const calls = [];
  return {
    calls,
    run: async (command, args) => {
      calls.push([command, args]);
      const result = results.shift() ?? 0;
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

nodeTest(
  'local E2E starts only the test project, forwards flags, and always tears it down',
  async () => {
    const fake = runner();
    assert.equal(await runTask('e2e', ['--runInBand'], fake.run), 0);
    assert.equal(fake.calls.length, 3);
    for (const call of [fake.calls[0], fake.calls[2]]) {
      assert.equal(call[0], 'docker');
      assert.ok(call[1].includes('quickapi-nestjs-test'));
      assert.ok(call[1].includes('.env.test'));
      assert.ok(call[1].includes('docker-compose.test.yml'));
    }
    assert.ok(fake.calls[1][1].includes('--runInBand'));
    assert.ok(fake.calls[2][1].includes('down'));
    assert.ok(fake.calls[2][1].includes('--volumes'));
  },
);

for (const [stage, results, code] of [
  ['startup', [7, 0], 7],
  ['tests', [0, 9, 0], 9],
  ['interrupted test', [0, 130, 0], 130],
  ['cleanup', [0, 0, 3], 3],
  ['test and cleanup', [0, 9, 3], 9],
])
  nodeTest(`preserves ${stage} failure and cleans up`, async () => {
    const fake = runner(results);
    assert.equal(await runTask('e2e', [], fake.run), code);
    assert.ok(fake.calls.at(-1)[1].includes('down'));
  });

nodeTest('cleans up even when startup cannot spawn', async () => {
  const fake = runner([new Error('cannot start docker'), 0]);
  await assert.rejects(runTask('e2e', [], fake.run), /cannot start docker/);
  assert.ok(fake.calls.at(-1)[1].includes('down'));
});

nodeTest('rejects unsupported commands without starting anything', async () => {
  const fake = runner();
  await assert.rejects(runTask('production', [], fake.run), /Unsupported/);
  assert.equal(fake.calls.length, 0);
});

nodeTest(
  'does not replace a startup exception with a cleanup exception',
  async () => {
    const fake = runner([
      new Error('startup failed'),
      new Error('cleanup failed'),
    ]);
    await assert.rejects(runTask('e2e', [], fake.run), /startup failed/);
  },
);

nodeTest(
  'reports a cleanup exception after otherwise successful tests',
  async () => {
    const fake = runner([0, 0, new Error('cleanup failed')]);
    await assert.rejects(runTask('e2e', [], fake.run), /cleanup failed/);
  },
);

nodeTest(
  'managed local infrastructure rejects inherited development targets',
  () => {
    assert.throws(
      () =>
        assertLocalInfrastructure({ DB_HOST: '127.0.0.1', DB_PORT: '3307' }),
      /DB_PORT/,
    );
  },
);

nodeTest(
  'preparation seeds only after successful migrations and propagates failures',
  async () => {
    for (const [results, expected, count] of [
      [[0, 0], 0, 2],
      [[8], 8, 1],
      [[0, 9], 9, 2],
    ]) {
      const fake = runner([...results]);
      assert.equal(await runTask('prepare', [], fake.run), expected);
      assert.equal(fake.calls.length, count);
      assert.ok(fake.calls[0][1].includes('migration:run'));
      if (count === 2)
        assert.ok(fake.calls[1][1].includes('src/database/seed.ts'));
    }
  },
);
