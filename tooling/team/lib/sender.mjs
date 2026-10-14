// Delivery of outbox events to the logical PM (or, for role-to-role messages, the target member).
// Delivery records live in <teamDir>/delivery.json: one record per eventId, so duplicates are
// ignored. States: queued -> sent -> received. "sent" means the prompt was submitted; only an
// explicit PM ack (`team ack`) makes it "received".
import path from 'node:path';
import { readJson, writeAtomic, withLock } from './store.mjs';
import { IMPORTANT } from './outbox.mjs';

export const MAX_ATTEMPTS = 3;

export function loadDelivery(teamDir) { return readJson(path.join(teamDir, 'delivery.json'), { records: {} }); }
function saveDelivery(teamDir, data) { writeAtomic(path.join(teamDir, 'delivery.json'), JSON.stringify(data, null, 2) + '\n'); }

// Registers newly seen events (idempotent by eventId) and returns their receipt times.
export function registerEvents(teamDir, events, now) {
  return withLock(path.join(teamDir, 'delivery-lock'), () => {
    const data = loadDelivery(teamDir);
    const fresh = [];
    for (const e of events) {
      if (data.records[e.eventId]) continue;
      data.records[e.eventId] = { eventId: e.eventId, memberId: e.memberId, type: e.type, to: e.to ?? 'pm', state: e.type === 'heartbeat' ? 'local' : 'queued', receivedByController: now, attempts: 0, lastError: null };
      fresh.push({ event: e, receivedAt: now });
    }
    saveDelivery(teamDir, data);
    return fresh;
  });
}

// Groups queued events into prompts: important events one by one, progress coalesced per member.
export function planBatches(events, records) {
  const queued = events.filter(e => records[e.eventId]?.state === 'queued' || records[e.eventId]?.state === 'retry');
  const batches = [];
  const progress = new Map();
  for (const e of queued) {
    if (e.type === 'progress' || e.type === 'ack' || e.type === 'milestone') {
      const key = `${e.to ?? 'pm'}|${e.memberId}`;
      if (!progress.has(key)) { progress.set(key, { to: e.to ?? 'pm', events: [] }); batches.push(progress.get(key)); }
      progress.get(key).events.push(e);
    } else batches.push({ to: e.to ?? 'pm', events: [e] });
  }
  return batches;
}

export function formatBatch(teamId, batch) {
  const lines = batch.events.map(e => `- [${e.type}] ${e.memberId}${e.taskId ? ` ${e.taskId}` : ''} (${e.eventId}): ${e.summary}${e.paths?.length ? ` | ${e.paths.join(', ')}` : ''}`);
  const ids = batch.events.map(e => e.eventId).join(' ');
  return `[task-team ${teamId}] ${batch.events.length} 筆事件\n${lines.join('\n')}\n確認收到：team ack --team-dir <團隊目錄> --events ${ids}`;
}

// One delivery pass. resolveTarget(to) returns { paneId, status } of the logical recipient now
// (so a PM handoff redirects pending events). PM busy/blocked/waiting => stay queued.
export async function deliver({ teamDir, teamId, events, resolveTarget, herdr, now }) {
  const data = loadDelivery(teamDir);
  const batches = planBatches(events, data.records);
  const results = [];
  for (const batch of batches) {
    const target = await resolveTarget(batch.to);
    const ids = batch.events.map(e => e.eventId);
    if (!target || !target.paneId) { results.push({ ids, outcome: 'no-target' }); continue; }
    if (['working', 'blocked', 'waiting-for-quota'].includes(target.status)) { results.push({ ids, outcome: 'deferred', reason: target.status }); continue; }
    const r = await herdr.prompt(target.paneId, formatBatch(teamId, batch));
    results.push({ ids, outcome: r.outcome, error: r.error, paneId: target.paneId });
  }
  withLock(path.join(teamDir, 'delivery-lock'), () => {
    const latest = loadDelivery(teamDir);
    for (const r of results) for (const id of r.ids) {
      const rec = latest.records[id];
      if (!rec || rec.state === 'received') continue;
      if (r.outcome === 'sent') Object.assign(rec, { state: 'sent', sentAt: now, sentTo: r.paneId, attempts: rec.attempts + 1, lastError: null });
      else if (r.outcome === 'failed' || r.outcome === 'blocked' || r.outcome === 'unknown') {
        rec.attempts += 1; rec.lastError = r.error ?? r.outcome;
        // "unknown" (timeout) may have been delivered; never resend blindly beyond the limit.
        rec.state = rec.attempts >= MAX_ATTEMPTS ? 'failed' : 'retry';
      }
    }
    saveDelivery(teamDir, latest);
  });
  return results;
}

// PM confirms receipt. Unknown IDs are reported, not invented.
export function acknowledge(teamDir, eventIds, now) {
  return withLock(path.join(teamDir, 'delivery-lock'), () => {
    const data = loadDelivery(teamDir);
    const result = { received: [], unknown: [] };
    for (const id of eventIds) {
      const rec = data.records[id];
      if (!rec) { result.unknown.push(id); continue; }
      rec.state = 'received'; rec.receivedAt = rec.receivedAt ?? now; result.received.push(id);
    }
    saveDelivery(teamDir, data);
    return result;
  });
}

export const isImportant = type => IMPORTANT.has(type);
