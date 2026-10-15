// Minimal reporting permissions. The notify helper lives at a fixed path inside this repo and
// only submits an event that already exists in the caller's own outbox; it cannot run other
// herdr commands. These rules add allows only; managed or user deny/ask rules still win.
//
// Rule syntax follows https://code.claude.com/docs/en/permissions (checked against Claude Code
// 2.1.300 on 2026-10-15):
//  * File rules are matched through Edit(...) and Read(...) only. A path rule written for Write(...)
//    is accepted but never consulted, so the outbox grant is an Edit rule (it covers the built-in
//    file-editing tools, Write included).
//  * Patterns use gitignore syntax. An absolute path starts with // . On Windows paths are first
//    normalised to POSIX form (C:\Users\a becomes /c/Users/a), so the absolute rule is //c/Users/a.
//  * Pattern metacharacters in the path itself are escaped with a backslash.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { outboxDir } from './outbox.mjs';
import { commandLine, DEFAULT_SHELL } from './commandline.mjs';

export const NOTIFY_SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../notify.mjs');
const slash = p => p.replace(/\\/g, '/');

// argv of the fixed notify command; eventId may be a placeholder shown to the role.
export function notifyArgv({ teamDir, memberId, eventId }) {
  return ['node', slash(NOTIFY_SCRIPT), '--team-dir', slash(teamDir), '--member', memberId, '--event', eventId];
}

// The exact command line a role is told to run, quoted for the role's shell.
export function notifyCommandLine(options, shell = DEFAULT_SHELL) { return commandLine(shell, notifyArgv(options)); }

// Escapes gitignore metacharacters that may occur in a real directory name.
export const escapeGlob = text => text.replace(/[\\*?[\]!#]/g, ch => `\\${ch}`);

// C:\a\b -> //c/a/b ; /home/x -> //home/x . The leading // anchors at the filesystem root.
export function absoluteRulePath(file) {
  const posix = slash(path.resolve(file));
  const drive = posix.match(/^([A-Za-z]):\/(.*)$/);
  const normalised = drive ? `/${drive[1].toLowerCase()}/${drive[2]}` : posix;
  if (!normalised.startsWith('/')) throw new Error(`RULE_PATH_NOT_ABSOLUTE: ${file}`);
  return `/${escapeGlob(normalised)}`;
}

// Bash permission pattern for the notify command: the SAME quoted command line a role is told to
// run, with the event id replaced by an unquoted * wildcard. Paths with spaces are quoted exactly
// as the formatter quotes them, so rule and command cannot drift apart. A glob metacharacter inside
// a literal part would change what the rule matches, so such values are refused.
export function bashRule({ teamDir, memberId }) {
  const guard = value => { if (/[*?[\]]/.test(value)) throw new Error(`RULE_VALUE_HAS_GLOB: ${value}`); return value; };
  const line = commandLine('posix', notifyArgv({ teamDir: guard(teamDir), memberId: guard(memberId), eventId: 'EVENT' }));
  const suffix = ' EVENT';
  if (!line.endsWith(suffix)) throw new Error('RULE_FORMAT_UNEXPECTED');
  return `Bash(${line.slice(0, -suffix.length)} *)`;
}

// Claude --settings payload for one role session: the member's OWN outbox and the one fixed
// notify command. Whether these rules are honoured on a given install is confirmed by a real CLI
// run (see the task-team verification notes); until then they are unverified.
export function sessionSettings({ teamDir, memberId }) {
  const outbox = absoluteRulePath(path.join(teamDir, 'outbox', memberId));
  return { permissions: { allow: [`Edit(${outbox}/**)`, bashRule({ teamDir, memberId })] } };
}

// Transport check without model tokens: can the controller write the member's own outbox and does
// the notify helper exist? This is a local OS-level check only; it is NOT proof that a Claude
// session's allow rules (Edit(outbox) + the fixed notify command) are granted.
export function checkTransport(teamDir, memberId) {
  const result = { kind: 'controller-os-write-check', outboxWritable: false, notifyPresent: fs.existsSync(NOTIFY_SCRIPT), claudePermissionVerified: false };
  try {
    const dir = outboxDir(teamDir, memberId); // validates the member id and refuses traversal/junctions
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.probe-${process.pid}`);
    fs.writeFileSync(probe, 'x', { flag: 'wx' }); fs.rmSync(probe);
    result.outboxWritable = true;
  } catch (error) { result.outboxError = error.code ?? error.message; }
  return result;
}
