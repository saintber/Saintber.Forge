import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseShim, resolveCommand, run } from '../lib/proc.mjs';
import { tempDir } from './helpers.mjs';

const NATIVE = '@ECHO off\r\nGOTO start\r\n:find_dp0\r\nSET dp0=%~dp0\r\nEXIT /b\r\n:start\r\nSETLOCAL\r\nCALL :find_dp0\r\n"%dp0%\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe"   %*\r\n';
const NODE = '@ECHO off\r\nSET "_prog=node"\r\nendLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\node_modules\\@openai\\codex\\bin\\codex.js" %*\r\n';

function pkg(dir, rel, content = 'x') { const f = path.join(dir, ...rel.split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); return f; }

test('a static npm shim pointing at a native exe resolves to that exe, spawned directly', () => tempDir(dir => {
  const exe = pkg(dir, 'node_modules/@anthropic-ai/claude-code/bin/claude.exe');
  assert.deepEqual(parseShim(NATIVE, dir), { file: exe, prefix: [] });
}));

test('a static npm shim that runs a node script resolves to node plus the script', () => tempDir(dir => {
  const js = pkg(dir, 'node_modules/@openai/codex/bin/codex.js');
  assert.deepEqual(parseShim(NODE, dir), { file: process.execPath, prefix: [js] });
}));

test('a shim cannot redirect outside its own directory, name a missing file or an odd extension', () => tempDir(dir => {
  pkg(dir, 'outside/evil.exe');
  const bin = path.join(dir, 'bin'); fs.mkdirSync(bin);
  assert.equal(parseShim('"%dp0%\\..\\outside\\evil.exe" %*', bin), null, 'parent traversal refused');
  assert.equal(parseShim('"%dp0%\\node_modules\\missing\\tool.exe" %*', bin), null, 'missing target refused');
  pkg(bin, 'node_modules/x/run.bat');
  assert.equal(parseShim('"%dp0%\\node_modules\\x\\run.bat" %*', bin), null, '.bat is not an allowed launcher');
  assert.equal(parseShim('echo nothing here', bin), null);
}));

test('the shim is only read, never executed', () => tempDir(dir => {
  const marker = path.join(dir, 'executed.txt');
  pkg(dir, 'node_modules/x/bin/tool.exe');
  // If this text were executed by cmd the marker file would appear; parsing must not run it.
  const text = `@ECHO off\r\necho owned > "${marker}"\r\n"%dp0%\\node_modules\\x\\bin\\tool.exe" %*\r\n`;
  assert.ok(parseShim(text, dir));
  assert.ok(!fs.existsSync(marker));
}));

test('resolveCommand finds a native shim through PATH on Windows and prefers a plain .exe', { skip: process.platform !== 'win32' }, () => tempDir(dir => {
  const exe = pkg(dir, 'node_modules/@anthropic-ai/claude-code/bin/claude.exe');
  fs.writeFileSync(path.join(dir, 'claude.cmd'), NATIVE);
  assert.deepEqual(resolveCommand('claude', { PATH: dir }), { file: exe, prefix: [] });
  assert.equal(resolveCommand('absent-cli', { PATH: dir }), null);
  const direct = pkg(dir, 'tool.exe');
  assert.equal(resolveCommand('tool', { PATH: dir }).file, direct);
}));

test('run() reports timeouts and non-zero exits without throwing and without a shell', async () => {
  const slow = await run(process.execPath, ['-e', 'setTimeout(()=>{}, 5000)'], { timeoutMs: 300 });
  assert.equal(slow.timedOut, true);
  const bad = await run(process.execPath, ['-e', 'process.exit(3)'], { timeoutMs: 5000 });
  assert.equal(bad.code, 3);
  const meta = await run(process.execPath, ['-e', 'console.log(process.argv[1])', 'a & echo pwned'], { timeoutMs: 5000 });
  assert.equal(meta.stdout.trim(), 'a & echo pwned', 'arguments are passed verbatim, not interpreted by a shell');
});
