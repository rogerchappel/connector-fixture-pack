import assert from 'node:assert/strict';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const checker = path.resolve('scripts/check-package.js');

async function runChecker(mutator) {
  const directory = await mkdtemp(path.join(tmpdir(), 'connector-fixture-pack-check-'));
  try {
    await cp('.', directory, {
      recursive: true,
      filter: (source) => !source.includes(`${path.sep}.git${path.sep}`) && !source.includes(`${path.sep}node_modules${path.sep}`)
    });
    if (mutator) await mutator(directory);
    return spawnSync(process.execPath, [checker], { cwd: directory, encoding: 'utf8' });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('package checker accepts compliant package contents', async () => {
  const result = await runChecker();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /package check passed/);
});

test('package checker rejects each required package file', async () => {
  for (const file of ['README.md', 'SKILL.md', 'docs/PRD.md', 'docs/TASKS.md', 'docs/ORCHESTRATION.md', 'schemas/bundle.schema.json', 'fixtures/crm-basic/bundle.json']) {
    const result = await runChecker(async (directory) => {
      const { rm: remove } = await import('node:fs/promises');
      await remove(path.join(directory, file));
    });
    assert.notEqual(result.status, 0, `${file} should be required`);
  }
});

test('package checker rejects missing CLI, exports, or smoke metadata', async () => {
  for (const key of ['bin', 'exports', 'scripts']) {
    const result = await runChecker(async (directory) => {
      const file = path.join(directory, 'package.json');
      const pkg = JSON.parse(await (await import('node:fs/promises')).readFile(file, 'utf8'));
      if (key === 'scripts') delete pkg.scripts.smoke;
      else delete pkg[key];
      await writeFile(file, `${JSON.stringify(pkg, null, 2)}\n`);
    });
    assert.notEqual(result.status, 0, `${key} should be required`);
    assert.match(result.stderr, /package metadata is missing CLI, exports, or smoke script/);
  }
});


test('package checker rejects missing declared bin and exports targets', async () => {
  for (const field of ['bin', 'exports']) {
    const result = await runChecker(async (directory) => {
      const file = path.join(directory, 'package.json');
      const pkg = JSON.parse(await (await import('node:fs/promises')).readFile(file, 'utf8'));
      pkg[field] = Object.fromEntries(Object.entries(pkg[field]).map(([key]) => [key, './missing-target.js']));
      await writeFile(file, `${JSON.stringify(pkg, null, 2)}\n`);
    });
    assert.notEqual(result.status, 0, `${field} target should be required`);
    assert.match(result.stderr, /package target does not exist/);
  }
});
