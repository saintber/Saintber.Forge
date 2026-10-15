import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionSettings, absoluteRulePath, escapeGlob, notifyArgv, NOTIFY_SCRIPT } from '../lib/permissions.mjs';

test('file grant uses Edit(...) with a // absolute anchor, never Write(...) or a global rule', () => {
  const dir = process.platform === 'win32' ? 'C:\\Work\\team-1' : '/work/team-1';
  const { permissions } = sessionSettings({ teamDir: dir, memberId: 'PG-1' });
  const file = permissions.allow.filter(r => /^(Edit|Write|Read)\(/.test(r));
  assert.equal(file.length, 1);
  assert.match(file[0], /^Edit\(\/\//);
  assert.ok(file[0].endsWith('/outbox/PG-1/**)'));
  if (process.platform === 'win32') assert.equal(file[0], 'Edit(//c/Work/team-1/outbox/PG-1/**)');
  assert.ok(!permissions.allow.some(r => /^Write\(/.test(r)), 'path rules on Write are never consulted by the CLI');
  assert.ok(!permissions.allow.some(r => /^(Edit|Bash)\(\*?\*?\)?$/.test(r) || r === 'Bash' || r === 'Edit'), 'no blanket allow');
});

test('the Bash grant is the exact notify command with only the event id free', () => {
  const dir = process.platform === 'win32' ? 'C:\\Work\\team-1' : '/work/team-1';
  const { permissions } = sessionSettings({ teamDir: dir, memberId: 'PG-1' });
  const bash = permissions.allow.filter(r => r.startsWith('Bash('));
  assert.equal(bash.length, 1);
  assert.ok(bash[0].includes(NOTIFY_SCRIPT.replace(/\\/g, '/')));
  assert.ok(bash[0].includes('--member PG-1 --event *)'));
  assert.ok(!/herdr/.test(bash[0]));
  assert.deepEqual(notifyArgv({ teamDir: dir, memberId: 'PG-1', eventId: 'ev-1' }).slice(0, 2), ['node', NOTIFY_SCRIPT.replace(/\\/g, '/')]);
});

test('pattern metacharacters in a directory name are escaped and spaced paths are supported', () => {
  assert.equal(escapeGlob('a*b[c]!#'), 'a\\*b\\[c\\]\\!\\#');
  if (process.platform === 'win32') assert.equal(absoluteRulePath('C:\\a b\\x*y'), '//c/a b/x\\*y');
  const spaced = sessionSettings({ teamDir: process.platform === 'win32' ? 'C:\\has space\\t' : '/has space/t', memberId: 'PG-1' });
  assert.equal(spaced.permissions.allow.length, 2, 'a legitimate spaced path is a valid team directory');
  assert.match(spaced.permissions.allow[0], /has space/);
  assert.throws(() => sessionSettings({ teamDir: process.platform === 'win32' ? 'C:\\x\\t' : '/x/t', memberId: 'PG 1' }).permissions.allow.length === 2 ? (() => { throw new Error('member ids with spaces must be rejected'); })() : 0);
});
