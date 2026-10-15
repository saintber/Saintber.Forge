import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { quoteArg, commandLine } from '../lib/commandline.mjs';
import { bashRule, notifyCommandLine, sessionSettings } from '../lib/permissions.mjs';
import { ackCommandFor } from '../lib/controller.mjs';

const SPACED = process.platform === 'win32' ? 'C:\\Work Space\\team 1' : '/work space/team 1';
const ARGV = ['a b', "it's", '$HOME', 'x;y', '*', 'C:/Work Space/t', '', 'a"b', 'back\\slash'];
const PROBE = ['-e', 'console.log(JSON.stringify(process.argv.slice(1)))'];
const NODE = process.execPath.replace(/\\/g, '/');

// A native POSIX shell only. On Windows the PATH "bash" may be the WSL entry point (which cannot see
// C:/... programs), so Git Bash is chosen explicitly: CLAUDE_CODE_GIT_BASH_PATH, else Git's own bash.exe.
function nativePosixShell() {
  if (process.platform !== 'win32') return fs.existsSync('/bin/bash') ? '/bin/bash' : null;
  const candidates = [process.env.CLAUDE_CODE_GIT_BASH_PATH, 'C:\\Program Files\\Git\\bin\\bash.exe', 'C:\\Program Files\\Git\\usr\\bin\\bash.exe', 'C:\\Program Files (x86)\\Git\\bin\\bash.exe'];
  return candidates.find(c => c && fs.existsSync(c) && !/system32/i.test(c)) ?? null;
}
function powershell() {
  const names = process.platform === 'win32' ? ['pwsh.exe', 'powershell.exe'] : ['pwsh'];
  for (const name of names) { const r = spawnSync(name, ['-NoProfile', '-NonInteractive', '-Command', '$PSVersionTable.PSVersion.Major'], { encoding: 'utf8', windowsHide: true, timeout: 20000 }); if (!r.error && r.status === 0) return name; }
  return null;
}

test('plain tokens stay bare; spaces, quotes and shell metacharacters are quoted for each shell', () => {
  assert.equal(quoteArg('posix', 'C:/a/b'), 'C:/a/b');
  assert.equal(quoteArg('posix', 'a b'), "'a b'");
  assert.equal(quoteArg('posix', "it's"), "'it'\\''s'");
  assert.equal(quoteArg('posix', ''), "''");
  assert.equal(quoteArg('powershell', 'a b'), "'a b'");
  assert.equal(quoteArg('powershell', "it's"), "'it''s'");
  assert.throws(() => quoteArg('posix', 'a\nb'), /CONTROL/);
  assert.throws(() => quoteArg('cmd', 'x'), /SHELL_UNSUPPORTED/);
});

const bash = nativePosixShell();
test('posix quoting round-trips through a native POSIX shell (Git Bash on Windows) to the same argv', { skip: bash ? false : 'no native POSIX shell (Git Bash) on this machine' }, () => {
  const r = spawnSync(bash, ['-c', commandLine('posix', [NODE, ...PROBE, ...ARGV])], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  assert.equal(r.status, 0, `${bash}: ${r.stderr}`);
  assert.deepEqual(JSON.parse(r.stdout.trim()), ARGV);
});

const ps = powershell();
test('powershell quoting round-trips through a real PowerShell to the same argv', { skip: ps ? false : 'no PowerShell on this machine' }, () => {
  const r = spawnSync(ps, ['-NoProfile', '-NonInteractive', '-Command', commandLine('powershell', [process.execPath, ...PROBE, ...ARGV])], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout.trim()), ARGV);
});

test('the notify command and its permission rule come from the same formatter and agree for spaced paths', () => {
  const line = notifyCommandLine({ teamDir: SPACED, memberId: 'PG-1', eventId: 'ev-abc123' });
  const rule = bashRule({ teamDir: SPACED, memberId: 'PG-1' });
  assert.ok(rule.startsWith('Bash(') && rule.endsWith(' *)'));
  const prefix = rule.slice('Bash('.length, -' *)'.length);
  assert.ok(line.startsWith(prefix + ' '), `command "${line}" must start with the rule prefix "${prefix}"`);
  assert.equal(line.slice(prefix.length + 1), 'ev-abc123', 'only the event id is free');
  assert.match(prefix, /'[^']*[Ss]pace[^']*'/, 'spaced path is quoted, not rejected');
  assert.equal(sessionSettings({ teamDir: SPACED, memberId: 'PG-1' }).permissions.allow.length, 2);
});

test('ack command given to the PM quotes a spaced team directory', () => {
  const line = ackCommandFor(SPACED)(['ev-a', 'ev-b']);
  assert.match(line, /--team-dir '[^']* [^']*'/);
  assert.ok(line.endsWith('--events ev-a ev-b'));
});

test('glob metacharacters in the team dir or member are refused in rules', () => {
  assert.throws(() => bashRule({ teamDir: '/x/te*am', memberId: 'PG-1' }), /RULE_VALUE_HAS_GLOB/);
  assert.throws(() => bashRule({ teamDir: '/x/team', memberId: 'P?G' }), /RULE_VALUE_HAS_GLOB/);
});

test('the shell selection never picks the WSL entry point', () => {
  if (bash) assert.ok(!/system32/i.test(path.resolve(bash)));
});
