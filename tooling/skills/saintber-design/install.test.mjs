import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { install, outputs } from './install.mjs';

const source = fs.readFileSync(new URL('./SKILL.md', import.meta.url), 'utf8');
const targets = [...outputs(source).keys()];
function removeTemporary(directory) {
  const root = path.resolve(directory);
  const relative = path.relative(path.resolve(os.tmpdir()), root);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !/^saintber-design-(install|outside)-/.test(path.basename(root)) || fs.lstatSync(root).isSymbolicLink()) throw new Error('UNSAFE_TEST_CLEANUP');
  fs.rmSync(root, { recursive: true, force: true });
}
const fixture = callback => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'saintber-design-install-'));
  fs.mkdirSync(path.join(root, 'docs/governance/policy'), { recursive: true });
  fs.writeFileSync(path.join(root, 'AGENTS.md'), 'fixture governance');
  fs.writeFileSync(path.join(root, 'docs/governance/policy/README.md'), 'fixture policies');
  try { return callback(root); } finally { removeTemporary(root); }
};

test('all three agent entries share one source and repeat installation changes nothing', () => fixture(root => {
  assert.equal(install(root, source).entries.filter(item => item.action === 'created').length, 3);
  assert.equal(fs.readFileSync(path.join(root, targets[0]), 'utf8'), source);
  assert.equal(fs.readFileSync(path.join(root, targets[1]), 'utf8'), source);
  const toml = fs.readFileSync(path.join(root, targets[2]), 'utf8');
  assert.ok(toml.includes(source.split(/^---\r?\n[\s\S]*?\r?\n---\r?\n/)[1].trim()));
  assert.ok(toml.includes('{{args}}'));
  assert.ok(!toml.includes('!{') && !toml.includes('@{'));
  const registry = fs.readFileSync(path.join(root, '.agents/skills/saintber-design/installation.json'), 'utf8');
  assert.ok(install(root, source).entries.every(item => item.action === 'unchanged'));
  assert.equal(fs.readFileSync(path.join(root, '.agents/skills/saintber-design/installation.json'), 'utf8'), registry);
}));

test('source upgrade updates only managed content and keeps upstream skills', () => fixture(root => {
  install(root, source);
  const upstream = path.join(root, '.agents/skills/speckit-specify');
  fs.mkdirSync(upstream, { recursive: true });
  fs.writeFileSync(path.join(upstream, 'SKILL.md'), 'upstream content');
  const updated = source + '\nUpdated exploration guidance.\n';
  assert.ok(install(root, updated).entries.every(item => item.action === 'updated'));
  assert.equal(fs.readFileSync(path.join(upstream, 'SKILL.md'), 'utf8'), 'upstream content');
}));

for (const target of targets) {
  test(`local edits in ${target} block the entire upgrade without touching other entries`, () => fixture(root => {
    install(root, source);
    fs.appendFileSync(path.join(root, target), '\nuser local edit');
    const snapshots = targets.map(file => fs.readFileSync(path.join(root, file), 'utf8'));
    assert.throws(() => install(root, source + '\nnew source\n'), /LOCAL_CHANGES/);
    assert.deepEqual(targets.map(file => fs.readFileSync(path.join(root, file), 'utf8')), snapshots);
  }));
}

test('unmanaged destination is preserved and no other agent entry is created', () => fixture(root => {
  fs.mkdirSync(path.join(root, '.gemini/commands'), { recursive: true });
  fs.writeFileSync(path.join(root, targets[2]), 'unmanaged command');
  assert.throws(() => install(root, source), /LOCAL_CHANGES/);
  assert.equal(fs.readFileSync(path.join(root, targets[2]), 'utf8'), 'unmanaged command');
  assert.ok(!fs.existsSync(path.join(root, targets[0])));
}));

test('missing governance does not initialize Spec Kit or create agent directories', () => fixture(root => {
  fs.unlinkSync(path.join(root, 'AGENTS.md'));
  assert.throws(() => install(root, source), /MISSING_PROJECT_GOVERNANCE/);
  assert.ok(!fs.existsSync(path.join(root, '.agents')));
  assert.ok(!fs.existsSync(path.join(root, '.specify')));
}));

test('registry cannot redirect writes to arbitrary destinations', () => fixture(root => {
  install(root, source);
  const registry = path.join(root, '.agents/skills/saintber-design/installation.json');
  fs.writeFileSync(registry, JSON.stringify({ schemaVersion: 1, hashes: { '../../outside': 'a'.repeat(64) } }));
  assert.throws(() => install(root, source), /INVALID_INSTALLATION_REGISTRY/);
}));

test('symlinked or junction agent directories are rejected without writing outside the project', () => fixture(root => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'saintber-design-outside-'));
  try {
    fs.symlinkSync(outside, path.join(root, '.gemini'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => install(root, source), /LINK_PATH/);
    assert.deepEqual(fs.readdirSync(outside), []);
    assert.ok(!fs.existsSync(path.join(root, '.agents')));
  } finally { removeTemporary(outside); }
}));

test('broken symlink destinations are rejected rather than treated as new files', () => fixture(root => {
  fs.symlinkSync(path.join(root, 'missing-directory'), path.join(root, '.gemini'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => install(root, source), /LINK_PATH/);
}));

test('Gemini template refuses unintended file/shell interpolation and literal delimiter injection', () => {
  for (const fragment of ['!{echo secret}', '@{private-file}', "'''", '{{args}}']) assert.throws(() => outputs(source + fragment), /UNSAFE_GEMINI_TEMPLATE/);
});

test('non-directory target is rejected before writing', () => fixture(root => {
  const file = path.join(root, 'not-a-directory');
  fs.writeFileSync(file, 'keep');
  assert.throws(() => install(file, source), /INVALID_PROJECT_DIRECTORY/);
  assert.equal(fs.readFileSync(file, 'utf8'), 'keep');
}));
