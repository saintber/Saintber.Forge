// Child processes: argv arrays only, never a shell string; bounded time; hidden on Windows.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Static npm .cmd shims launch a path quoted relative to the shim directory, for example:
//   "%dp0%\node_modules\pkg\bin\tool.exe"   %*            (native executable)
//   "%_prog%"  "%dp0%\node_modules\pkg\bin\tool.js" %*    (node script)
// The shim is only READ as text and never executed. The target must stay under the shim's own
// directory, exist, and have an allowed extension, so a crafted shim cannot redirect a launch.
const SHIM_TARGET = /"%(?:~dp0|dp0%?)[\\/]?([^"%\r\n]+\.(exe|js|cjs|mjs))"/gi;

export function parseShim(text, dir) {
  const matches = [...text.matchAll(SHIM_TARGET)];
  if (!matches.length) return null;
  const [, relative, extension] = matches[matches.length - 1]; // the last static path is the launched target
  const root = path.resolve(dir);
  const full = path.resolve(root, relative.split(/[\\/]+/).join(path.sep));
  const inside = path.relative(root, full);
  if (!inside || inside.startsWith('..') || path.isAbsolute(inside) || !fs.existsSync(full)) return null;
  return extension.toLowerCase() === 'exe' ? { file: full, prefix: [] } : { file: process.execPath, prefix: [full] };
}

// Resolves a CLI by name without a shell. Windows: .exe on PATH, else a static npm .cmd shim.
// Elsewhere: PATH lookup. Returns { file, prefix } or null.
export function resolveCommand(name, env = process.env) {
  const dirs = (env.PATH || env.Path || '').split(path.delimiter).filter(Boolean);
  if (process.platform !== 'win32') {
    for (const dir of dirs) { const file = path.join(dir, name); if (fs.existsSync(file)) return { file, prefix: [] }; }
    return null;
  }
  for (const dir of dirs) {
    const exe = path.join(dir, `${name}.exe`);
    if (fs.existsSync(exe)) return { file: exe, prefix: [] };
    const cmd = path.join(dir, `${name}.cmd`);
    if (fs.existsSync(cmd)) {
      const found = parseShim(fs.readFileSync(cmd, 'utf8'), dir);
      if (found) return found;
    }
  }
  return null;
}

// Runs a command and resolves { code, stdout, stderr, timedOut }; never throws on non-zero exit.
export function run(file, args, { timeoutMs = 30000, input, cwd, env } = {}) {
  return new Promise(resolve => {
    let child;
    try {
      child = spawn(file, args, { cwd, env, shell: false, windowsHide: true, stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] });
    } catch (error) { resolve({ code: null, stdout: '', stderr: String(error.message), timedOut: false, error: error.code || 'SPAWN_FAILED' }); return; }
    let stdout = '', stderr = '', done = false;
    const finish = result => { if (!done) { done = true; clearTimeout(timer); resolve(result); } };
    const timer = setTimeout(() => { child.kill(); finish({ code: null, stdout, stderr, timedOut: true }); }, timeoutMs);
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => finish({ code: null, stdout, stderr: stderr + error.message, timedOut: false, error: error.code || 'SPAWN_FAILED' }));
    child.on('close', code => finish({ code, stdout, stderr, timedOut: false }));
    if (input !== undefined) { child.stdin.end(input); }
  });
}
