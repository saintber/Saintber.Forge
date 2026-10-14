// Minimal reporting permissions. The notify helper lives at a fixed path inside this repo and
// only submits an event that already exists in the caller's own outbox; it cannot run other
// herdr commands. These rules add allows only; managed or user deny/ask rules still win.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const NOTIFY_SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../notify.mjs');
const slash = p => p.replace(/\\/g, '/');

export function notifyCommand({ teamDir, memberId, eventId }) {
  return ['node', slash(NOTIFY_SCRIPT), '--team-dir', slash(teamDir), '--member', memberId, '--event', eventId];
}

// Claude --settings payload for one role session. Exact rule strings on Windows must be
// confirmed by a real CLI run; until then they are recorded as unverified.
export function sessionSettings({ teamDir, memberId }) {
  const outbox = slash(path.join(teamDir, 'outbox', memberId));
  return {
    permissions: {
      allow: [
        `Write(${outbox}/**)`,
        `Bash(node ${slash(NOTIFY_SCRIPT)} --team-dir ${slash(teamDir)} --member ${memberId} --event *)`,
      ],
    },
  };
}

// Transport check without model tokens: can the controller write the outbox and run notify?
export function checkTransport(teamDir, memberId) {
  const result = { outboxWritable: false, notifyPresent: fs.existsSync(NOTIFY_SCRIPT) };
  const dir = path.join(teamDir, 'outbox', memberId);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.probe-${process.pid}`);
    fs.writeFileSync(probe, 'x', { flag: 'wx' }); fs.rmSync(probe);
    result.outboxWritable = true;
  } catch (error) { result.outboxError = error.code; }
  return result;
}
