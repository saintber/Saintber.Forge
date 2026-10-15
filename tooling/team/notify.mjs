#!/usr/bin/env node
// Fixed notify helper for roles. Usage:
//   node tooling/team/notify.mjs --team-dir <dir> --member <memberId> --event <eventId>
// It only submits an event already stored in the caller's own outbox. It accepts no free
// command text, so a narrow allow rule for it cannot be used to run other herdr commands.
// Exit codes: 0 submitted (state printed: queued|sent|uncertain|received...), 1 refused or failed.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TeamStore, readJson, assertInside } from './lib/store.mjs';
import { outboxDir, validateEvent } from './lib/outbox.mjs';
import { tick } from './lib/controller.mjs';
import { loadDelivery } from './lib/sender.mjs';
import { createHerdr } from './lib/herdr.mjs';

const ID = /^[A-Za-z0-9_-]{6,80}$/;
const MEMBER = /^[A-Za-z][A-Za-z0-9_-]{0,60}$/;

export async function notify(argv, { herdr = createHerdr(), now = Date.now() } = {}) {
  if (argv.length !== 6 || argv[0] !== '--team-dir' || argv[2] !== '--member' || argv[4] !== '--event') throw new Error('USAGE: notify.mjs --team-dir <dir> --member <memberId> --event <eventId>');
  const [teamDir, memberId, eventId] = [path.resolve(argv[1]), argv[3], argv[5]];
  // Validate identifiers before any path is built or file is read.
  if (!MEMBER.test(memberId)) throw new Error(`NOTIFY_MEMBER_INVALID: ${memberId}`);
  if (!ID.test(eventId)) throw new Error(`NOTIFY_EVENT_ID_INVALID: ${eventId}`);
  const store = new TeamStore(teamDir);
  const state = store.read();
  if (!Object.hasOwn(state.members, memberId)) throw new Error(`NOTIFY_MEMBER_UNKNOWN: ${memberId}`);
  const dir = outboxDir(teamDir, memberId); // assertInside: rejects traversal and junctions
  const file = assertInside(dir, path.join(dir, `${eventId}.json`));
  const event = readJson(file);
  if (!event) throw new Error(`NOTIFY_EVENT_NOT_IN_OUTBOX: ${eventId}`);
  const error = validateEvent(event, { teamId: state.teamId, memberId, eventId, members: state.members });
  if (error) throw new Error(`NOTIFY_EVENT_INVALID: ${error}`);
  // Register and attempt delivery now; the watcher retries anything still queued. Re-running is
  // safe: the journal never sends an already sent/uncertain/received item again.
  await tick({ teamDir, herdr, now, diagnose: false });
  const record = loadDelivery(teamDir).records[eventId];
  return { eventId, delivery: record?.state ?? 'queued', attempts: record?.attempts ?? 0 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  notify(process.argv.slice(2)).then(r => console.log(JSON.stringify(r)), e => { console.error(e.message); process.exitCode = 1; });
}
