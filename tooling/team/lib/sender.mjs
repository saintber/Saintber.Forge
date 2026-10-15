// Delivery journal and sender. Items are role events (to the logical PM or a member) and
// assignments (to a member). One record per item id in <teamDir>/delivery.json.
//
// States: queued -> sending (claimed) -> sent -> received
//         sending/timeout -> uncertain -> (verified in the target pane) sent | retry | failed
// Rules: claim and finalize are short locked steps; the Herdr call happens with no lock held, so
// two concurrent ticks/notifies cannot both send an item. The real target (pane + session) is
// journaled BEFORE the send. An uncertain outcome is never resent on weak evidence: seeing the id
// in the recorded pane only means "sent" (never "received"); NOT seeing it proves nothing (it may
// have scrolled out), so the item stays uncertain for the PM to decide. Only an idle/done target
// receives work.
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { readJson, writeAtomic, withLock, processAlive } from './store.mjs';

export const MAX_ATTEMPTS = 3;
const READY = new Set(['idle', 'done']);
const lockDir = teamDir => path.join(teamDir, 'delivery-lock');

export function loadDelivery(teamDir) { return readJson(path.join(teamDir, 'delivery.json'), { records: {} }); }
const save = (teamDir, data) => writeAtomic(path.join(teamDir, 'delivery.json'), JSON.stringify(data, null, 2) + '\n');
const mutate = (teamDir, fn) => withLock(lockDir(teamDir), () => { const data = loadDelivery(teamDir); const out = fn(data); save(teamDir, data); return out; });

// Idempotently registers items; returns the receipt time recorded for each id.
export function register(teamDir, items, now) {
  return mutate(teamDir, data => {
    for (const it of items) {
      if (data.records[it.id]) continue;
      data.records[it.id] = { id: it.id, kind: it.kind, memberId: it.memberId ?? null, type: it.type ?? null, to: it.to, state: it.local ? 'local' : 'queued', receivedByController: now, attempts: 0, lastError: null };
    }
    return Object.fromEntries(items.map(it => [it.id, data.records[it.id].receivedByController]));
  });
}

// A claim whose owner process is gone became "uncertain": the prompt may or may not have been
// submitted. A live owner is never presumed dead because of age (it may just be waiting on Herdr).
export function recoverStale(teamDir, now, isAlive = processAlive) {
  return mutate(teamDir, data => {
    const changed = [];
    for (const r of Object.values(data.records)) {
      if (r.state !== 'sending' || isAlive(r.claimPid)) continue;
      r.state = 'uncertain'; r.lastError = 'claim-owner-gone'; changed.push(r.id);
    }
    return changed;
  });
}

// Checks the journaled target (not whoever is PM now) for the item id. Seen => sent (still not
// received). Not seen => stays uncertain: absence in a bounded scrollback proves nothing.
export async function verifyUncertain({ teamDir, herdr }) {
  const data = loadDelivery(teamDir);
  const out = [];
  for (const r of Object.values(data.records)) {
    if (r.state !== 'uncertain' || !r.target?.paneId) continue;
    const pane = await herdr.pane(r.target.paneId).catch(() => null);
    // Only the same pane with the same session can be asked about this item.
    if (!pane || (r.target.session && pane.agent_session?.value !== r.target.session)) continue;
    const screen = await herdr.readPane(r.target.paneId, 300);
    if (screen && screen.includes(r.id)) {
      mutate(teamDir, d => { const rec = d.records[r.id]; if (rec?.state === 'uncertain') { rec.state = 'sent'; rec.verified = 'seen-in-recorded-pane'; rec.sentTo = r.target.paneId; } });
      out.push({ id: r.id, seen: true });
    }
  }
  return out;
}

// PM decision for an uncertain item: 'resend' (accept possible duplicate) or 'drop'.
export function resolveUncertain(teamDir, id, decision) {
  return mutate(teamDir, data => {
    const rec = data.records[id];
    if (!rec || rec.state !== 'uncertain') throw new Error(`NOT_UNCERTAIN: ${id}`);
    if (!['resend', 'drop'].includes(decision)) throw new Error(`DECISION_INVALID: ${decision}`);
    rec.state = decision === 'resend' ? 'retry' : 'failed'; rec.resolvedBy = 'pm'; rec.resolution = decision;
    return rec.state;
  });
}

// Groups a target's queued items: important events stay separate; progress/ack/milestone from
// one member coalesce into one prompt. Assignments are always separate.
export function planPrompts(items) {
  const prompts = [];
  const coalesce = new Map();
  for (const it of items) {
    if (it.kind === 'event' && ['progress', 'ack', 'milestone'].includes(it.type)) {
      const key = `${it.to}|${it.memberId}`;
      if (!coalesce.has(key)) { const p = { to: it.to, items: [] }; coalesce.set(key, p); prompts.push(p); }
      coalesce.get(key).items.push(it);
    } else prompts.push({ to: it.to, items: [it] });
  }
  return prompts;
}

export function formatPrompt(teamId, prompt, ackCommand) {
  const lines = prompt.items.map(it => it.line);
  const body = `[task-team ${teamId}] ${prompt.items.length} 筆\n${lines.join('\n')}`;
  const ackable = prompt.items.filter(it => it.kind === 'event');
  return ackable.length ? `${body}\n確認收到：${ackCommand(ackable.map(it => it.id))}` : body;
}

// One pass over `items` (descriptors built by the controller from outboxes and assignments).
// item: { id, kind, memberId, type, to, line }.
export async function deliver({ teamDir, teamId, items, resolveTarget, herdr, now, ackCommand, claimPid = process.pid }) {
  const nowMs = Date.parse(now);
  recoverStale(teamDir, nowMs);
  const verified = await verifyUncertain({ teamDir, herdr });
  const records = loadDelivery(teamDir).records;
  const open = items.filter(it => ['queued', 'retry'].includes(records[it.id]?.state));
  const targets = new Map();
  for (const it of open) if (!targets.has(it.to)) targets.set(it.to, await resolveTarget(it.to));
  const results = [];
  const ready = [];
  for (const it of open) {
    const t = targets.get(it.to);
    if (!t?.paneId) results.push({ id: it.id, outcome: 'no-target' });
    else if (!READY.has(t.status)) results.push({ id: it.id, outcome: 'deferred', reason: t.status ?? 'unknown' }); // unknown is not ready
    else ready.push(it);
  }
  // Claim: only items still queued/retry become ours.
  const claimId = randomUUID();
  const mine = mutate(teamDir, data => ready.filter(it => {
    const r = data.records[it.id];
    if (!r || !['queued', 'retry'].includes(r.state)) return false;
    const t = targets.get(it.to);
    // Journal the real target before sending so later verification asks the right pane.
    Object.assign(r, { state: 'sending', claimId, claimPid, claimedAt: now, target: { paneId: t.paneId, session: t.session ?? null } });
    return true;
  }));
  const stillReady = new Map();
  for (const prompt of planPrompts(mine)) {
    // After the first prompt the recipient is probably working; check again before each send.
    let target = targets.get(prompt.to);
    if (stillReady.has(prompt.to)) {
      target = await resolveTarget(prompt.to);
      stillReady.set(prompt.to, target);
    } else stillReady.set(prompt.to, target);
    if (!target?.paneId || !READY.has(target.status)) {
      // Not ready any more: release the claim untouched (nothing was sent).
      mutate(teamDir, data => { for (const it of prompt.items) { const rec = data.records[it.id]; if (rec?.claimId === claimId && rec.state === 'sending') Object.assign(rec, { state: 'queued', claimId: null, lastError: 'recipient-not-ready' }); } });
      for (const it of prompt.items) results.push({ id: it.id, outcome: 'deferred', reason: target?.status ?? 'unknown' });
      continue;
    }
    const r = await herdr.prompt(target.paneId, formatPrompt(teamId, prompt, ackCommand)); // no lock held
    stillReady.set(prompt.to, { ...target, status: 'working' }); // we just gave it work
    mutate(teamDir, data => {
      for (const it of prompt.items) {
        const rec = data.records[it.id];
        if (!rec || rec.claimId !== claimId || rec.state !== 'sending') continue;
        rec.attempts += 1;
        if (r.outcome === 'sent') Object.assign(rec, { state: 'sent', sentAt: now, sentTo: target.paneId, lastError: null });
        else if (r.outcome === 'blocked') Object.assign(rec, { state: 'queued', lastError: 'target-blocked' }); // rejected before any input was sent
        else if (r.outcome === 'not-submitted') { rec.lastError = r.error; rec.state = rec.attempts >= MAX_ATTEMPTS ? 'failed' : 'retry'; } // known: nothing was written
        else Object.assign(rec, { state: 'uncertain', lastError: r.error ?? r.outcome }); // timeout / unclassified error: may have been delivered
      }
    });
    for (const it of prompt.items) results.push({ id: it.id, outcome: r.outcome, error: r.error });
  }
  return { results, verified };
}

// PM confirms receipt. Unknown ids are reported, not invented.
export function acknowledge(teamDir, ids, now) {
  return mutate(teamDir, data => {
    const out = { received: [], unknown: [] };
    for (const id of ids) {
      const rec = data.records[id];
      if (!rec) { out.unknown.push(id); continue; }
      rec.state = 'received'; rec.receivedAt = rec.receivedAt ?? now; out.received.push(id);
    }
    return out;
  });
}

export const stateOf = (teamDir, id) => loadDelivery(teamDir).records[id]?.state ?? null;
