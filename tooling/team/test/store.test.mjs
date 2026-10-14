import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { withLock, TeamStore, writeNew } from '../lib/store.mjs';
import { tempDir } from './helpers.mjs';

test('a live owner keeps its lock even when the lock directory looks old', () => tempDir(dir => {
  let inner = 'not-run';
  withLock(dir, () => {
    const old = new Date(Date.now() - 3600_000);
    fs.utimesSync(path.join(dir, '.lock'), old, old);
    assert.throws(() => withLock(dir, () => { inner = 'stolen'; }, { attempts: 2, waitMs: 1 }), /STATE_LOCKED/);
    assert.ok(fs.existsSync(path.join(dir, '.lock')), 'outer lock must still exist');
  });
  assert.equal(inner, 'not-run');
  assert.ok(!fs.existsSync(path.join(dir, '.lock')));
}));

test('a lock whose owner process is gone is recovered', () => tempDir(dir => {
  fs.mkdirSync(path.join(dir, '.lock'));
  fs.writeFileSync(path.join(dir, '.lock', 'owner.json'), JSON.stringify({ pid: 999999, nonce: 'dead' }));
  assert.equal(withLock(dir, () => 'ran', { isAlive: () => false }), 'ran');
}));

test('a lock without owner info is not broken', () => tempDir(dir => {
  fs.mkdirSync(path.join(dir, '.lock'));
  assert.throws(() => withLock(dir, () => 1, { attempts: 2, waitMs: 1, isAlive: () => false }), /STATE_LOCKED/);
}));

test('release only removes the lock this call still owns', () => tempDir(dir => {
  withLock(dir, () => {
    // Simulate another owner replacing the lock while we run.
    fs.writeFileSync(path.join(dir, '.lock', 'owner.json'), JSON.stringify({ pid: process.pid, nonce: 'someone-else' }));
  });
  assert.ok(fs.existsSync(path.join(dir, '.lock')), 'foreign lock must survive our release');
}));

test('async callbacks are refused so a lock is never held across awaits', () => tempDir(dir => {
  assert.throws(() => withLock(dir, async () => 1), /LOCK_CALLBACK_MUST_BE_SYNC/);
  assert.ok(!fs.existsSync(path.join(dir, '.lock')));
}));

test('store updates bump the revision and create-only writes refuse to overwrite', () => tempDir(dir => {
  const store = new TeamStore(dir);
  store.create({ teamId: 't' });
  assert.throws(() => store.create({ teamId: 't' }), /TEAM_EXISTS/);
  store.update(s => { s.x = 1; });
  assert.equal(store.read().revision, 2);
  writeNew(path.join(dir, 'a.json'), '1');
  assert.throws(() => writeNew(path.join(dir, 'a.json'), '2'), /EEXIST/);
  assert.equal(fs.readFileSync(path.join(dir, 'a.json'), 'utf8'), '1');
}));

test('team paths refuse junctions and escapes', () => tempDir(dir => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'task-team-test-outside-'));
  try {
    const team = path.join(dir, 'team');
    fs.mkdirSync(team);
    fs.symlinkSync(outside, path.join(team, 'outbox'), 'junction');
    const store = new TeamStore(team);
    assert.throws(() => store.path('outbox', 'PM-1', 'x.json'), /LINK_IN_TEAM_PATH/);
    assert.throws(() => store.path('..', 'other'), /PATH_OUTSIDE_TEAM_DIR/);
  } finally { fs.rmSync(path.join(dir, 'team', 'outbox'), { force: true, recursive: false }); fs.rmSync(outside, { recursive: true, force: true }); }
}));
