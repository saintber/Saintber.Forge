// Threshold semantics (§6.4), entry selection (§6.3) and pending migration (§6.6).
//
// An observation describes one entry's quota as seen by an adapter or a manual record:
//   { at, reliable, remaining?, hardLimit?, signal?, windows?, pool? }
// signal: 'quota-exhausted' (provider said so) or a non-quota error such as 'rate-limited',
// 'context-full', 'auth', 'permission', 'network'. Only quota-exhausted counts as a limit.

export const NON_QUOTA_SIGNALS = new Set(['rate-limited', 'context-full', 'auth', 'permission', 'network']);

// Minimum remaining across the windows that actually constrain the entry; any missing value
// makes the whole observation unknown (no mapping, no number => unknown, not stop).
export function remainingFromWindows(windows) {
  if (!Array.isArray(windows) || windows.length === 0) return null;
  let min = Infinity;
  for (const w of windows) {
    const remaining = typeof w.remainingPercent === 'number' ? w.remainingPercent
      : typeof w.usedPercent === 'number' ? 100 - w.usedPercent : null;
    if (remaining === null || !Number.isFinite(remaining) || remaining < 0 || remaining > 100) return null;
    min = Math.min(min, remaining);
  }
  return Math.max(0, min);
}

// Normalises an observation: stale or incomplete data becomes unknown.
export function normalise(observation, { now = Date.now(), maxAgeMs = 120000 } = {}) {
  if (!observation) return { known: false, limit: false, signal: null };
  const signal = observation.signal ?? null;
  const fresh = observation.at === undefined || now - Date.parse(observation.at) <= maxAgeMs;
  let remaining = typeof observation.remaining === 'number' ? observation.remaining : remainingFromWindows(observation.windows);
  // Percent values outside 0..100 are corrupt data: unknown, never a recovery or exhaustion proof.
  const valid = remaining !== null && Number.isFinite(remaining) && remaining >= 0 && remaining <= 100;
  const known = observation.reliable === true && fresh && valid;
  if (!known) remaining = null;
  const limit = signal === 'quota-exhausted' || (observation.reliable === true && fresh && (observation.hardLimit === true || remaining === 0));
  return { known, remaining, limit, signal };
}

// Returns 'continue' | 'switch' | 'wait' | 'non-quota-error'.
// 'switch' is never immediate: callers record a pending migration for the next safe boundary.
export function evaluate(entry, observation, options) {
  const obs = normalise(observation, options);
  const threshold = entry.remainingThreshold.value;
  if (obs.signal && NON_QUOTA_SIGNALS.has(obs.signal)) return 'non-quota-error';
  if (threshold < 0) return obs.limit ? 'wait' : 'continue';
  if (obs.limit) return 'switch';
  if (threshold > 0 && obs.known && obs.remaining < threshold) return 'switch';
  return 'continue';
}

// §6.3: first enabled, launchable entry at or after `from` that the threshold rules allow.
// A negative-threshold entry is chosen even when exhausted (it waits); quota never makes an
// entry "not launchable". Returns { index, entry, status } or { index: -1, reasons }.
export function selectEntry(entries, { from = 0, providers = {}, canLaunch = () => true, observe = () => null, exhaustedPools = new Set(), options } = {}) {
  const reasons = [];
  for (let index = from; index < entries.length; index++) {
    const entry = entries[index];
    const provider = providers[entry.provider];
    if (!entry.enabled || !provider || provider.enabled !== true) { reasons.push({ index, reason: 'disabled' }); continue; }
    const launch = canLaunch(entry);
    if (launch !== true) { reasons.push({ index, reason: 'not-launchable', detail: launch }); continue; }
    const negative = entry.remainingThreshold.value < 0;
    const pool = entry.quotaPool ?? provider.quotaPool;
    // A known-exhausted pool stays exhausted until reliable recovery; missing data cannot erase it.
    if (pool && exhaustedPools.has(pool)) {
      if (negative) return { index, entry, status: 'waiting-for-quota' };
      reasons.push({ index, reason: 'pool-exhausted' }); continue;
    }
    const verdict = evaluate(entry, observe(entry), options);
    if (verdict === 'wait') return { index, entry, status: 'waiting-for-quota' };
    if (verdict === 'switch') { reasons.push({ index, reason: 'threshold' }); continue; }
    return { index, entry, status: 'active' };
  }
  return { index: -1, reasons };
}

// Records (or keeps) a pending migration. Pending remembers whether a real limit was seen.
export function markPending(modelState, verdict, observation, options) {
  if (verdict !== 'switch') return modelState;
  const obs = normalise(observation, options);
  const pending = modelState.pending ?? { since: new Date(options?.now ?? Date.now()).toISOString(), limitSeen: false };
  return { ...modelState, pending: { ...pending, limitSeen: pending.limitSeen || obs.limit } };
}

// At a safe boundary: decide whether the pending migration still applies using the latest
// non-inference observation. Only reliable recovery evidence cancels it; after a real limit,
// unknown/missing data never cancels.
export function recheckAtBoundary(entry, modelState, latestObservation, options) {
  if (!modelState.pending) return { migrate: false, state: modelState };
  const obs = normalise(latestObservation, options);
  const recovered = obs.known && !obs.limit && evaluate(entry, latestObservation, options) === 'continue';
  if (recovered) { const { pending, ...rest } = modelState; return { migrate: false, state: rest, cancelled: true }; }
  return { migrate: true, state: modelState };
}
