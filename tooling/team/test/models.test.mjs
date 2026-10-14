import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, selectEntry, normalise, markPending, recheckAtBoundary, remainingFromWindows } from '../lib/models.mjs';

const now = Date.parse('2026-10-14T10:00:00Z');
const at = new Date(now - 1000).toISOString();
const opts = { now, maxAgeMs: 120000 };
const entry = value => ({ provider: 'p', model: 'm', enabled: true, remainingThreshold: { metric: 'quotaRemainingPercent', value } });
const known = remaining => ({ at, reliable: true, remaining });

test('threshold > 0 switches only when remaining is strictly below it', () => {
  assert.equal(evaluate(entry(50), known(49), opts), 'switch');
  assert.equal(evaluate(entry(50), known(50), opts), 'continue');
  assert.equal(evaluate(entry(50), known(51), opts), 'continue');
});

test('unknown quota is usable until a real limit signal for threshold >= 0', () => {
  assert.equal(evaluate(entry(50), null, opts), 'continue');
  assert.equal(evaluate(entry(50), { at, reliable: false, remaining: 1 }, opts), 'continue');
  assert.equal(evaluate(entry(0), null, opts), 'continue');
  assert.equal(evaluate(entry(50), { at, signal: 'quota-exhausted' }, opts), 'switch');
});

test('threshold 0 switches on provider exhaustion or reliable remaining=0, not on low values', () => {
  assert.equal(evaluate(entry(0), known(1), opts), 'continue');
  assert.equal(evaluate(entry(0), known(0), opts), 'switch');
  assert.equal(evaluate(entry(0), { at, reliable: true, windows: [{ usedPercent: 100 }] }, opts), 'switch');
  assert.equal(evaluate(entry(0), { at, reliable: true, hardLimit: true }, opts), 'switch');
  assert.equal(evaluate(entry(0), { at, signal: 'quota-exhausted' }, opts), 'switch');
});

test('negative threshold keeps working when low or unknown and waits only on a real limit', () => {
  assert.equal(evaluate(entry(-1), known(1), opts), 'continue');
  assert.equal(evaluate(entry(-1), null, opts), 'continue');
  assert.equal(evaluate(entry(-1), known(0), opts), 'wait');
  assert.equal(evaluate(entry(-1), { at, signal: 'quota-exhausted' }, opts), 'wait');
});

test('non-quota errors never count as exhaustion', () => {
  for (const signal of ['rate-limited', 'context-full', 'auth', 'permission', 'network']) {
    assert.equal(evaluate(entry(0), { at, signal }, opts), 'non-quota-error');
    assert.equal(evaluate(entry(-1), { at, signal }, opts), 'non-quota-error');
  }
});

test('stale observations are unknown; multiple windows use the minimum remaining', () => {
  assert.equal(normalise({ at: new Date(now - 600000).toISOString(), reliable: true, remaining: 0 }, opts).known, false);
  assert.equal(evaluate(entry(0), { at: new Date(now - 600000).toISOString(), reliable: true, remaining: 0 }, opts), 'continue');
  assert.equal(remainingFromWindows([{ usedPercent: 79 }, { usedPercent: 33 }]), 21);
  assert.equal(remainingFromWindows([{ usedPercent: 79 }, {}]), null);
  assert.equal(evaluate(entry(50), { at, reliable: true, windows: [{ usedPercent: 79 }, { usedPercent: 33 }] }, opts), 'switch');
});

test('selection: first eligible entry in order, disabled and threshold-exhausted entries skipped', () => {
  const providers = { p: { enabled: true }, off: { enabled: false } };
  const list = [{ ...entry(0), provider: 'off' }, { ...entry(0), enabled: false }, entry(50), entry(0)];
  const pick = selectEntry(list, { providers, observe: e => (e === list[2] ? known(10) : null), options: opts });
  assert.equal(pick.index, 3);
  assert.deepEqual(pick.reasons, undefined);
});

test('selection: negative-threshold entry already exhausted is still chosen and waits', () => {
  const providers = { p: { enabled: true } };
  const list = [entry(-1), entry(0)];
  const pick = selectEntry(list, { providers, observe: () => known(0), options: opts });
  assert.equal(pick.index, 0);
  assert.equal(pick.status, 'waiting-for-quota');
});

test('selection: quota is not "not launchable"; launch failure is a separate reason', () => {
  const providers = { p: { enabled: true } };
  const pick = selectEntry([entry(0)], { providers, canLaunch: () => 'CLI_NOT_FOUND', options: opts });
  assert.equal(pick.index, -1);
  assert.equal(pick.reasons[0].reason, 'not-launchable');
});

test('selection: cursor never moves backward and same exhausted pool is skipped for >= 0', () => {
  const providers = { p: { enabled: true, quotaPool: 'pool-a' }, q: { enabled: true, quotaPool: 'pool-b' } };
  const list = [entry(0), entry(0), { ...entry(0), provider: 'q' }, entry(-1)];
  assert.equal(selectEntry(list, { from: 1, providers, options: opts }).index, 1);
  const pick = selectEntry(list, { from: 1, providers, exhaustedPools: new Set(['pool-a']), options: opts });
  assert.equal(pick.index, 2);
  const neg = selectEntry([entry(-1)], { providers, exhaustedPools: new Set(['pool-a']), observe: () => known(0), options: opts });
  assert.equal(neg.status, 'waiting-for-quota');
});

test('pending migration: reliable recovery cancels, unknown after a real limit does not', () => {
  let state = markPending({ cursor: 0 }, 'switch', known(0), opts);
  assert.equal(state.pending.limitSeen, true);
  assert.equal(recheckAtBoundary(entry(0), state, null, opts).migrate, true);
  assert.equal(recheckAtBoundary(entry(0), state, { at, reliable: false }, opts).migrate, true);
  const recovered = recheckAtBoundary(entry(0), state, known(80), opts);
  assert.equal(recovered.migrate, false);
  assert.equal(recovered.state.pending, undefined);
  state = markPending({ cursor: 0 }, 'switch', known(40), opts);
  assert.equal(recheckAtBoundary(entry(50), state, known(50), opts).migrate, false);
  assert.equal(recheckAtBoundary(entry(50), state, known(45), opts).migrate, true);
});

test('known-exhausted pool keeps a negative entry waiting even with no observation', () => {
  const providers = { p: { enabled: true, quotaPool: 'pool-a' } };
  const pick = selectEntry([entry(-1), entry(0)], { providers, exhaustedPools: new Set(['pool-a']), observe: () => null, options: opts });
  assert.equal(pick.index, 0);
  assert.equal(pick.status, 'waiting-for-quota');
});
