// Role outbox: each member stores its own events as files before submitting them.
// Layout: <teamDir>/outbox/<memberId>/<eventId>.json; files are create-only.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { writeNew, assertInside } from './store.mjs';

export const EVENT_TYPES = new Set(['ack', 'progress', 'heartbeat', 'checkpoint', 'milestone', 'blocked', 'decision-needed', 'completed', 'handoff', 'waiting-for-quota', 'message']);
// Never coalesced away; each is delivered on its own.
export const IMPORTANT = new Set(['blocked', 'decision-needed', 'completed', 'handoff', 'waiting-for-quota', 'message']);
const ID = /^[A-Za-z0-9_-]{6,80}$/;
const MEMBER = /^[A-Za-z][A-Za-z0-9_-]{0,60}$/;

export const outboxDir = (teamDir, memberId) => {
  if (!MEMBER.test(memberId)) throw new Error(`INVALID_MEMBER_ID: ${memberId}`);
  return assertInside(teamDir, path.join(teamDir, 'outbox', memberId));
};

export function newEventId() { return `ev-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`; }

// Validates an event against the team and the file it was read from.
export function validateEvent(event, { teamId, memberId, eventId, members }) {
  if (!event || typeof event !== 'object') return 'EVENT_INVALID';
  if (event.teamId !== teamId) return 'EVENT_TEAM_MISMATCH';
  if (event.memberId !== memberId) return 'EVENT_MEMBER_MISMATCH';
  if (event.eventId !== eventId || !ID.test(eventId)) return 'EVENT_ID_MISMATCH';
  if (!EVENT_TYPES.has(event.type)) return 'EVENT_TYPE_INVALID';
  if (typeof event.summary !== 'string' || !event.summary.trim() || event.summary.length > 2000) return 'EVENT_SUMMARY_INVALID';
  if (event.paths !== undefined && (!Array.isArray(event.paths) || event.paths.some(p => typeof p !== 'string'))) return 'EVENT_PATHS_INVALID';
  if (event.type === 'message' && (typeof event.to !== 'string' || !members[event.to])) return 'EVENT_TARGET_INVALID';
  if (event.type === 'checkpoint' && (!Array.isArray(event.paths) || event.paths.length !== 1 || !event.paths[0].trim())) return 'EVENT_CHECKPOINT_PATH_REQUIRED';
  if (!members[memberId]) return 'EVENT_MEMBER_UNKNOWN';
  return null;
}

// Helper for roles (and tests) to store an event in their own outbox. Roles may also write
// the JSON file with their own file tool; the controller reads either the same way.
export function writeEvent(teamDir, teamId, memberId, fields) {
  const eventId = fields.eventId ?? newEventId();
  if (typeof eventId !== 'string' || !ID.test(eventId)) throw new Error(`INVALID_EVENT_ID: ${eventId}`);
  for (const key of ['teamId', 'memberId', 'schemaVersion', 'createdAt']) {
    if (key in fields) throw new Error(`EVENT_IDENTITY_OVERRIDE: ${key}`);
  }
  // Identity is fixed by the caller's own member and applied last.
  const event = { ...fields, schemaVersion: 1, teamId, memberId, eventId, createdAt: new Date().toISOString() };
  const dir = outboxDir(teamDir, memberId);
  writeNew(assertInside(dir, path.join(dir, `${eventId}.json`)), JSON.stringify(event, null, 2) + '\n');
  return event;
}

// Lists events across all member outboxes; invalid files are reported, not deleted.
export function scanOutboxes(teamDir, { teamId, members }) {
  const root = assertInside(teamDir, path.join(teamDir, 'outbox'));
  const events = [], invalid = [];
  if (!fs.existsSync(root)) return { events, invalid };
  for (const memberId of fs.readdirSync(root)) {
    const dir = path.join(root, memberId);
    if (!MEMBER.test(memberId) || !fs.lstatSync(dir).isDirectory()) continue; // links are not directories under lstat
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.json') || !fs.lstatSync(path.join(dir, name)).isFile()) continue;
      const eventId = name.slice(0, -5);
      let event;
      try { event = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')); } catch { invalid.push({ memberId, eventId, error: 'EVENT_INVALID_JSON' }); continue; }
      const error = validateEvent(event, { teamId, memberId, eventId, members });
      if (error) invalid.push({ memberId, eventId, error }); else events.push(event);
    }
  }
  events.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)) || a.eventId.localeCompare(b.eventId));
  return { events, invalid };
}
