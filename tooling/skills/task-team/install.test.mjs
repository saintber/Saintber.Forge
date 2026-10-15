import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { install, outputs, entryPaths, registryPath, runtimeRoot } from './install.mjs';

const source = '---\nname: task-team\ndescription: 依任務啟動團隊\n---\n\n請使用 __TEAM_ROOT__/tooling/team/cli.mjs；遵守目標專案治理。\n';
async function fixture(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'task-team-install-'));
  try { return await fn(root); } finally {
    if (path.dirname(root) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith('task-team-install-')) throw new Error('UNSAFE_FIXTURE_CLEANUP');
    fs.rmSync(root, { recursive: true, force: true });
  }
}
const read = (root, relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const snapshot = root => [...entryPaths, registryPath].map(p => read(root, p));

test('installs all three entries in a foreign repository without requiring Hub or Spec Kit', () => fixture(root => {
  const result = install(root, source);
  assert.deepEqual(result.entries.map(e => e.action), ['created', 'created', 'created']);
  assert.equal(read(root, entryPaths[0]), read(root, entryPaths[1]));
  assert.ok(read(root, entryPaths[0]).includes(runtimeRoot.replace(/\\/g, '/') + '/tooling/team/cli.mjs'));
  assert.ok(!read(root, entryPaths[0]).includes('__TEAM_ROOT__'));
  assert.match(read(root, entryPaths[2]), /\{\{args\}\}/);
  assert.ok(!read(root, entryPaths[2]).includes('name: task-team'));
  assert.equal(fs.existsSync(path.join(root, '.specify')), false);
  assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
}));

test('reinstall is idempotent, preserves line endings, and upgrades only managed unchanged entries', () => fixture(root => {
  install(root, source);
  for (const p of entryPaths) fs.writeFileSync(path.join(root, p), read(root, p).replace(/\n/g, '\r\n'));
  const before = snapshot(root);
  assert.ok(install(root, source).entries.every(e => e.action === 'unchanged'));
  assert.deepEqual(snapshot(root), before);
  const result = install(root, source + '\n更新規則。\n');
  assert.ok(result.entries.every(e => e.action === 'updated'));
  assert.ok(entryPaths.every(p => read(root, p).includes('更新規則。')));
}));

for (const p of entryPaths) test(`a local edit in ${p} blocks every entry upgrade`, () => fixture(root => {
  install(root, source);
  fs.appendFileSync(path.join(root, p), '\n使用者修改');
  const before = snapshot(root);
  assert.throws(() => install(root, source + '\n新版。'), /LOCAL_CHANGES/);
  assert.deepEqual(snapshot(root), before);
}));

test('an unmanaged conflicting entry is preserved before any other entry is created', () => fixture(root => {
  fs.mkdirSync(path.join(root, '.gemini/commands'), { recursive: true });
  fs.writeFileSync(path.join(root, entryPaths[2]), 'original user command');
  assert.throws(() => install(root, source), /LOCAL_CHANGES/);
  assert.equal(read(root, entryPaths[2]), 'original user command');
  assert.equal(fs.existsSync(path.join(root, entryPaths[0])), false);
  assert.equal(fs.existsSync(path.join(root, entryPaths[1])), false);
}));

test('a corrupt or foreign registry blocks changes', () => fixture(root => {
  install(root, source);
  fs.writeFileSync(path.join(root, registryPath), JSON.stringify({ schemaVersion: 1, normalization: 'lf', hashes: { '../other': 'a'.repeat(64) } }));
  const before = snapshot(root);
  assert.throws(() => install(root, source + '\n更新。'), /INVALID_INSTALLATION_REGISTRY/);
  assert.deepEqual(snapshot(root), before);
}));

test('a junction in an agent destination and a linked project root cannot escape the target', () => fixture(root => {
  const target = path.join(root, 'target'); const outside = path.join(root, 'outside');
  fs.mkdirSync(target); fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(target, '.claude'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => install(target, source), /LINK_PATH/);
  assert.deepEqual(fs.readdirSync(outside), []);
  assert.equal(fs.existsSync(path.join(target, entryPaths[0])), false);
  const alias = path.join(root, 'alias');
  fs.symlinkSync(target, alias, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => install(alias, source), /INVALID_PROJECT_DIRECTORY|LINK_PROJECT_DIRECTORY/);
}));

test('agent entries never overwrite upstream Spec Kit files', () => fixture(root => {
  const upstream = path.join(root, '.agents/skills/speckit-specify/SKILL.md');
  fs.mkdirSync(path.dirname(upstream), { recursive: true }); fs.writeFileSync(upstream, 'upstream content');
  install(root, source);
  assert.equal(fs.readFileSync(upstream, 'utf8'), 'upstream content');
}));

test('an interrupted upgrade restores only entries written by that attempt', t => fixture(root => {
  install(root, source);
  const before = snapshot(root);
  const rename = fs.renameSync;
  let fail = true;
  t.mock.method(fs, 'renameSync', (from, to) => {
    if (fail && to === path.join(root, entryPaths[1])) { fail = false; throw new Error('SIMULATED_IO_FAILURE'); }
    return rename(from, to);
  });
  assert.throws(() => install(root, source + '\n新版。\n'), /SIMULATED_IO_FAILURE/);
  assert.deepEqual(snapshot(root), before);
}));

test('unsafe Gemini interpolation and malformed skill sources are rejected before writing', () => fixture(root => {
  for (const suffix of ['\n!{echo hi}', '\n@{secret}', '\n{{args}}', "\n'''", '\n\0']) {
    assert.throws(() => install(root, source + suffix), /UNSAFE_GEMINI_TEMPLATE/);
  }
  assert.throws(() => install(root, 'missing frontmatter'), /INVALID_SKILL/);
  assert.deepEqual(fs.readdirSync(root), []);
  const wanted = outputs(source, { sourceRoot: path.join(root, 'runtime with spaces') });
  assert.ok(wanted.get(entryPaths[0]).includes('runtime with spaces/tooling/team/cli.mjs'));
}));

const childInstall = root => new Promise((resolve, reject) => {
  const script = `import {install} from ${JSON.stringify(new URL('./install.mjs', import.meta.url).href)}; install(process.argv[1], process.argv[2]);`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', script, root, source], { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  const timer = setTimeout(() => { child.kill(); reject(new Error('INSTALL_TIMEOUT')); }, 15000);
  child.stderr.on('data', d => { stderr += d; });
  child.on('error', e => { clearTimeout(timer); reject(e); });
  child.on('close', code => { clearTimeout(timer); if (code === 0) resolve(); else reject(new Error(`INSTALL_EXIT_${code}: ${stderr}`)); });
});

test('two real installer processes serialize and leave consistent managed entries', () => fixture(async root => {
  await Promise.all([childInstall(root), childInstall(root)]);
  const registry = JSON.parse(read(root, registryPath));
  assert.deepEqual(Object.keys(registry.hashes).sort(), entryPaths.toSorted());
  assert.ok(install(root, source).entries.every(e => e.action === 'unchanged'));
}));
