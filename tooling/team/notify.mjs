#!/usr/bin/env node
// Fixed notify helper for roles. Usage:
//   node tooling/team/notify.mjs --team-dir <dir> --member <memberId> --event <eventId>
// It only submits an event already stored in the caller's own outbox. It accepts no free
// command text, so a narrow allow rule for it cannot be used to run other herdr commands.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TeamStore, readJson } from './lib/store.mjs';
import { outboxDir, validateEvent } from './lib/outbox.mjs';
import { tick } from './lib/controller.mjs';
import { createHerdr } from './lib/herdr.mjs';

export async function notify(argv, { herdr = createHerdr(), now = Date.now() } = {}) {
  if (argv.length !== 6 || argv[0] !== '--team-dir' || argv[2] !== '--member' || argv[4] !== '--event') throw new Error('USAGE: notify.mjs --team-dir <dir> --member <memberId> --event <eventId>');
  const [teamDir, memberId, eventId] = [path.resolve(argv[1]), argv[3], argv[5]];
  const store = new TeamStore(teamDir);
  const state = store.read();
  if (!state.members[memberId]) throw new Error(`NOTIFY_MEMBER_UNKNOWN: ${memberId}`);
  const file = path.join(outboxDir(teamDir, memberId), `${eventId}.json`);
  const event = readJson(file);
  if (!event) throw new Error(`NOTIFY_EVENT_NOT_IN_OUTBOX: ${eventId}`);
  const error = validateEvent(event, { teamId: state.teamId, memberId, eventId, members: state.members });
  if (error) throw new Error(`NOTIFY_EVENT_INVALID: ${error}`);
  // Register and attempt delivery now; the watcher retries anything still queued.
  const result = await tick({ teamDir, herdr, now, diagnose: false });
  const mine = result.delivery.find(d => d.ids.includes(eventId));
  return { eventId, delivery: mine?.outcome ?? 'queued' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  notify(process.argv.slice(2)).then(r => console.log(JSON.stringify(r)), e => { console.error(e.message); process.exitCode = 1; });
}
