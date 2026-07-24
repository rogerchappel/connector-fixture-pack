import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
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

test('CLI lint exits non-zero for schema-invalid fixture values', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'connector-fixture-pack-cli-schema-'));
  try {
    await cp('fixtures/crm-basic', directory, { recursive: true });
    await writeFile(
      path.join(directory, 'responses.json'),
      `${JSON.stringify([{
        id: 'response-1',
        requestId: 'crm-create-note',
        status: 'complete',
        body: []
      }], null, 2)}\n`
    );

    const result = spawnSync(process.execPath, ['./bin/connector-fixture-pack.js', 'lint', directory], {
      encoding: 'utf8'
    });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /"ok": false/);
    assert.match(result.stdout, /Entry 0 status must be one of: dry_run, mocked, blocked/);
    assert.match(result.stdout, /Entry 0 body must be an object/);
    assert.equal(result.stderr, '');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('CLI lint and render expose missing write approvals', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'connector-fixture-pack-cli-approval-'));
  try {
    await cp('fixtures/crm-basic', directory, { recursive: true });
    await writeFile(path.join(directory, 'approvals.json'), '[]\n');

    const lint = spawnSync(process.execPath, ['./bin/connector-fixture-pack.js', 'lint', directory], {
      encoding: 'utf8'
    });
    assert.equal(lint.status, 1);
    assert.match(lint.stdout, /"ok": false/);
    assert.match(lint.stdout, /POST request crm-create-note requires an approval/);
    assert.equal(lint.stderr, '');

    const render = spawnSync(process.execPath, ['./bin/connector-fixture-pack.js', 'render', directory], {
      encoding: 'utf8'
    });
    assert.equal(render.status, 0);
    assert.match(render.stdout, /Lint status: fail/);
    assert.match(render.stdout, /ERROR approvals\.json: POST request crm-create-note requires an approval/);
    assert.equal(render.stderr, '');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
