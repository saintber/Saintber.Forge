import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PREFIX = 'task-team-test-';

// Temp directories are removed only when they are ours: under os.tmpdir(), our prefix, not a link.
export function removeTemp(dir) {
  const root = path.resolve(dir);
  const rel = path.relative(path.resolve(os.tmpdir()), root);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel) || !path.basename(root).startsWith(PREFIX) || fs.lstatSync(root).isSymbolicLink()) throw new Error('UNSAFE_TEST_CLEANUP');
  fs.rmSync(root, { recursive: true, force: true });
}

export function tempDir(callback) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), PREFIX));
  let result;
  try { result = callback(dir); } catch (error) { removeTemp(dir); throw error; }
  if (result && typeof result.then === 'function') return result.finally(() => removeTemp(dir));
  removeTemp(dir);
  return result;
}

export const exampleConfig = () => JSON.parse(fs.readFileSync(new URL('../config/team.example.json', import.meta.url), 'utf8'));

// A scripted fake process runner: handlers match on (file, args) and return results.
export function fakeExec(handler) {
  const calls = [];
  const exec = async (file, args, opts) => {
    calls.push({ file, args: [...args], opts });
    const r = await handler(file, args, opts, calls);
    return { code: 0, stdout: '', stderr: '', timedOut: false, ...r };
  };
  exec.calls = calls;
  return exec;
}
