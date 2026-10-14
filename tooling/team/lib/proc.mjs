// Child processes: argv arrays only, never a shell string; bounded time; hidden on Windows.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Resolve an npm-style CLI on Windows without invoking cmd.exe: prefer the package's
// node launcher next to the .cmd shim, otherwise the .exe. Elsewhere use PATH lookup.
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
      const text = fs.readFileSync(cmd, 'utf8');
      const match = text.match(/"%(?:~dp0|dp0%)\\?([^"%]+\.(?:js|cjs|mjs))"/i);
      if (match) {
        const script = path.join(dir, match[1].replace(/^\\/, ''));
        if (fs.existsSync(script)) return { file: process.execPath, prefix: [script] };
      }
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
