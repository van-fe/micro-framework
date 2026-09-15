import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, stat, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const originalPath = join(root, 'tests/upstream-issues/catalog.json');
const originalBytes = await readFile(originalPath, 'utf8');
const originalStat = await stat(originalPath, { bigint: true });
const catalog = JSON.parse(originalBytes);
const temporary = await mkdtemp(join(tmpdir(), 'upstream-import-history-'));
const workingCatalog = join(temporary, 'catalog.json');
const inputPath = join(temporary, 'input.json');
const completed = catalog.issues.find(issue => ['fixed', 'regression-passed'].includes(issue.status));
assert(completed, 'requires completed evidence in source catalog');
const changedDuplicate = {
  ...completed,
  repository: completed.repository.toUpperCase(),
  id: `${completed.repository.toUpperCase()}#${completed.number}`,
  status: 'collected', tests: [], resolution: '',
};
const incoming = {
  repository: catalog.sources[0].repository,
  number: 2_000_000,
  labels: ['bug'], selection: 'bug-label', status: 'collected', tests: [], resolution: '',
};
incoming.id = `${incoming.repository}#${incoming.number}`;
incoming.url = `https://github.com/${incoming.repository}/issues/${incoming.number}`;
assert(!catalog.issues.some(issue => issue.id.toLowerCase() === incoming.id.toLowerCase()));
async function run(input, expectSuccess = true) {
  await writeFile(workingCatalog, originalBytes);
  await writeFile(inputPath, JSON.stringify(input));
  const before = await stat(workingCatalog, { bigint: true });
  const result = spawnSync('bun', ['scripts/upstream-issues.mjs', '--catalog', workingCatalog, 'import', inputPath], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status === 0, expectSuccess, result.stderr);
  const after = await stat(workingCatalog, { bigint: true });
  const bytes = await readFile(workingCatalog, 'utf8');
  assert.deepEqual((await readdir(temporary)).filter(name => name.endsWith('.tmp')), []);
  return { value: JSON.parse(bytes), bytes, before, after, output: (result.stdout || result.stderr).trim() };
}
try {
  const added = await run([incoming]);
  assert.deepEqual(added.value.sources, catalog.sources, 'adding an issue must not rewrite historical source snapshots');
  assert.deepEqual(added.value, { ...catalog, issues: [...catalog.issues, incoming] });
  console.log(`PASS new-only: ${added.output}`);
  const mixed = await run({ issues: [changedDuplicate, incoming] });
  assert.deepEqual(mixed.value, { ...catalog, issues: [...catalog.issues, incoming] });
  console.log(`PASS mixed case-insensitive duplicate and new: ${mixed.output}`);
  const duplicate = await run([changedDuplicate]);
  assert.equal(duplicate.bytes, originalBytes);
  assert.equal(duplicate.after.mtimeNs, duplicate.before.mtimeNs);
  assert.equal(duplicate.after.ino, duplicate.before.ino);
  console.log(`PASS duplicate-only preserves bytes/mtime/inode: ${duplicate.output}`);
  for (const [name, payload] of [
    ['invalid mixed import', [incoming, { ...incoming, number: incoming.number + 1, resolution: false }]],
    ['input duplicate identity', [incoming, { ...incoming, repository: incoming.repository.toUpperCase(), id: incoming.id.toUpperCase() }]],
  ]) {
    const rejected = await run(payload, false);
    assert.equal(rejected.bytes, originalBytes);
    assert.equal(rejected.after.mtimeNs, rejected.before.mtimeNs);
    assert.equal(rejected.after.ino, rejected.before.ino);
    console.log(`PASS ${name} rejects atomically: ${rejected.output}`);
  }
} finally {
  assert.equal(await readFile(originalPath, 'utf8'), originalBytes, 'original catalog bytes changed');
  assert.equal((await stat(originalPath, { bigint: true })).mtimeNs, originalStat.mtimeNs, 'original catalog mtime changed');
  await rm(temporary, { recursive: true, force: true });
  console.log('Original catalog bytes and mtime unchanged; temporary verification data removed.');
}
