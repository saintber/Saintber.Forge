#!/usr/bin/env node
// Generate three agent entries from one skill; the runtime stays in this checkout.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { withLock, writeAtomic } from '../../team/lib/store.mjs';

const sourceDir = path.dirname(fileURLToPath(import.meta.url));
export const runtimeRoot = path.resolve(sourceDir, '../../..');
export const registryPath = '.agents/skills/task-team/installation.json';
export const entryPaths = [
  '.agents/skills/task-team/SKILL.md',
  '.claude/skills/task-team/SKILL.md',
  '.gemini/commands/task-team.toml',
];
const lf = text => text.replace(/\r\n/g, '\n');
const sha = text => createHash('sha256').update(lf(text)).digest('hex');
const read = file => {
  try { return fs.readFileSync(file, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
};

// Check every component, including broken links. Destinations are fixed, never user-supplied.
function targetPath(root, relative, directory = false) {
  const parts = relative.split('/');
  let current = root;
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    let stat;
    try { stat = fs.lstatSync(current); } catch (e) { if (e.code === 'ENOENT') continue; throw e; }
    if (stat.isSymbolicLink()) throw new Error(`LINK_PATH: ${relative}`);
    if (i < parts.length - 1 || directory) {
      if (!stat.isDirectory()) throw new Error(`INVALID_PATH_TYPE: ${relative}`);
    } else if (!stat.isFile()) throw new Error(`INVALID_PATH_TYPE: ${relative}`);
  }
  return current;
}

export function outputs(source, { sourceRoot = runtimeRoot } = {}) {
  const rendered = lf(source).replaceAll('__TEAM_ROOT__', path.resolve(sourceRoot).replace(/\\/g, '/'));
  const fm = rendered.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fm || !/^name: task-team$/m.test(fm[1]) || !/^description: .+$/m.test(fm[1])) throw new Error('INVALID_SKILL');
  const body = rendered.slice(fm[0].length).trim();
  if (!body || ["'''", '!{', '@{', '{{args}}', '\0'].some(s => body.includes(s))) throw new Error('UNSAFE_GEMINI_TEMPLATE');
  const gemini = '# Generated from tooling/skills/task-team/SKILL.md; edit the source and reinstall.\n'
    + 'description = "依任務與組態啟動及協調 AI 團隊"\n'
    + `prompt = '''\n${body}\n\n使用者本次的輸入：\n{{args}}\n'''\n`;
  return new Map([[entryPaths[0], rendered], [entryPaths[1], rendered], [entryPaths[2], gemini]]);
}

function validateRegistry(text) {
  if (text === null) return { hashes: {} };
  let prior;
  try { prior = JSON.parse(text); } catch { throw new Error('INVALID_INSTALLATION_REGISTRY'); }
  if (prior.schemaVersion !== 1 || prior.normalization !== 'lf' || !prior.hashes || typeof prior.hashes !== 'object'
    || Array.isArray(prior.hashes) || Object.keys(prior.hashes).some(k => !entryPaths.includes(k))
    || Object.values(prior.hashes).some(v => typeof v !== 'string' || !/^[a-f0-9]{64}$/.test(v))) throw new Error('INVALID_INSTALLATION_REGISTRY');
  return prior;
}

export function install(projectDirectory, source = fs.readFileSync(path.join(sourceDir, 'SKILL.md'), 'utf8')) {
  const root = path.resolve(projectDirectory);
  let stat;
  try { stat = fs.lstatSync(root); } catch { throw new Error('INVALID_PROJECT_DIRECTORY'); }
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('INVALID_PROJECT_DIRECTORY');
  const canonical = fs.realpathSync(root);
  const norm = s => process.platform === 'win32' ? s.toLowerCase() : s;
  if (norm(canonical) !== norm(root)) throw new Error('LINK_PROJECT_DIRECTORY');
  // A foreign task repository does not need Hub governance files or Spec Kit.
  const wanted = outputs(source);
  for (const relative of [...entryPaths, registryPath]) targetPath(root, relative);
  const lockDir = targetPath(root, '.agents/skills/task-team/install-lock', true);
  return withLock(lockDir, () => {
    const registryFile = targetPath(root, registryPath);
    const registryBefore = read(registryFile);
    const prior = validateRegistry(registryBefore);
    const pending = [];
    // Preflight every agent before updating any entry.
    for (const [relative, content] of wanted) {
      const file = targetPath(root, relative);
      const before = read(file);
      if (before !== null && lf(before) !== content && (!Object.hasOwn(prior.hashes, relative) || sha(before) !== prior.hashes[relative])) throw new Error(`LOCAL_CHANGES: ${relative}`);
      pending.push({ relative, file, before, content });
    }
    const registryNext = JSON.stringify({ schemaVersion: 1, normalization: 'lf', sourceRoot: runtimeRoot,
      hashes: Object.fromEntries([...wanted].map(([relative, content]) => [relative, sha(content)])) }, null, 2) + '\n';
    pending.push({ relative: registryPath, file: registryFile, before: registryBefore, content: registryNext });
    const written = [], entries = [];
    try {
      for (const item of pending) {
        targetPath(root, item.relative);
        if (read(item.file) !== item.before) throw new Error(`CONCURRENT_CHANGE: ${item.relative}`);
        const unchanged = item.before !== null && lf(item.before) === item.content;
        if (!unchanged) { writeAtomic(item.file, item.content); written.push(item); }
        if (item.relative !== registryPath) entries.push({ path: item.relative, action: unchanged ? 'unchanged' : item.before === null ? 'created' : 'updated' });
      }
    } catch (error) {
      // Restore only our writes, and only while their contents still belong to this attempt.
      for (const item of written.reverse()) {
        try {
          targetPath(root, item.relative);
          if (read(item.file) !== item.content) continue;
          if (item.before === null) fs.unlinkSync(item.file); else writeAtomic(item.file, item.before);
        } catch { error.message += `; ROLLBACK_REQUIRES_REVIEW: ${item.relative}`; }
      }
      throw error;
    }
    return { projectDirectory: root, sourceRoot: runtimeRoot, entries };
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log('node tooling/skills/task-team/install.mjs --project-dir <task-repository>\nInstall task-team for Codex, Claude and Gemini; runtime stays in this checkout.');
  } else if (args.length === 2 && args[0] === '--project-dir') {
    try { console.log(JSON.stringify(install(args[1]), null, 2)); } catch (e) { console.error(e.message); process.exitCode = 1; }
  } else { console.error('Usage: node tooling/skills/task-team/install.mjs --project-dir <task-repository>'); process.exitCode = 1; }
}
