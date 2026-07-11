import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('CLI help entrypoint prints usage', () => {
  const result = spawnSync(process.execPath, ['./bin/connector-fixture-pack.js', '--help'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /connector-fixture-pack lint <dir>/);
  assert.equal(result.stderr, '');
});

test('CLI lint exits non-zero for unsafe fixture bundles', () => {
  const result = spawnSync(process.execPath, ['./bin/connector-fixture-pack.js', 'lint', 'fixtures/messaging-risky'], {
    encoding: 'utf8'
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /"ok": false/);
  assert.match(result.stdout, /Secret-like value/);
  assert.equal(result.stderr, '');
});
