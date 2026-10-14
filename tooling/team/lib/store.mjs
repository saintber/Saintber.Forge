// Team directory persistence: atomic writes, a directory lock and revision checks.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  fs.writeFileSync(temp, text, { encoding: 'utf8', flag: 'wx' });
  fs.renameSync(temp, file);
}

// Create-only write; refuses to replace an existing file (someone else's event or record).
export function writeNew(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, { encoding: 'utf8', flag: 'wx' });
}

export function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw new Error(`INVALID_JSON: ${file}`);
  }
}

const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// process.kill(pid, 0) throws ESRCH only when no such process exists; EPERM means it exists.
export function processAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; }
}

function readOwner(lock) {
  try { return JSON.parse(fs.readFileSync(path.join(lock, 'owner.json'), 'utf8')); } catch { return null; }
}

// A lock is a directory holding owner.json { pid, nonce }. It is only broken when the owner
// process is provably gone (same host, PID not running); age alone never breaks a lock.
// The callback must be synchronous: a Promise result is rejected so the lock is never held
// across awaits (no Herdr/network waits while locked).
export function withLock(dir, callback, { attempts = 100, waitMs = 20, isAlive = processAlive } = {}) {
  const root = path.resolve(dir);
  const lock = path.join(root, '.lock');
  fs.mkdirSync(root, { recursive: true });
  const nonce = randomUUID();
  for (let i = 0; ; i++) {
    try {
      fs.mkdirSync(lock);
      fs.writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ pid: process.pid, nonce, at: new Date().toISOString() }), { flag: 'wx' });
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const owner = readOwner(lock);
      // Missing owner.json can mean the holder is between mkdir and write; treat it as alive.
      if (owner && !isAlive(owner.pid)) {
        const stale = path.join(root, `.lock-stale-${randomUUID()}`);
        try { fs.renameSync(lock, stale); } catch { continue; }
        // Another process may have replaced the dead lock between our read and rename.
        const moved = readOwner(stale);
        if (moved && moved.nonce !== owner.nonce) { try { fs.renameSync(stale, lock); } catch {} }
        else fs.rmSync(stale, { recursive: true, force: true });
        continue;
      }
      if (i >= attempts) throw new Error('STATE_LOCKED');
      sleep(waitMs);
    }
  }
  try {
    const result = callback();
    if (result && typeof result.then === 'function') throw new Error('LOCK_CALLBACK_MUST_BE_SYNC');
    return result;
  } finally {
    // Release only if this call still owns the lock.
    const owner = readOwner(lock);
    if (owner && owner.nonce === nonce) {
      const released = path.join(root, `.lock-released-${randomUUID()}`);
      try { fs.renameSync(lock, released); fs.rmSync(released, { recursive: true, force: true }); } catch {}
    }
  }
}

// Refuses symlinks/junctions anywhere from base down to target so writes cannot escape the
// team directory. On Windows, lstat reports junctions as symbolic links.
export function assertInside(base, target) {
  const root = path.resolve(base);
  const full = path.resolve(target);
  const rel = path.relative(root, full);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`PATH_OUTSIDE_TEAM_DIR: ${target}`);
  let current = root;
  for (const part of ['', ...rel.split(path.sep).filter(Boolean)]) {
    current = part ? path.join(current, part) : current;
    let stat;
    try { stat = fs.lstatSync(current); } catch (error) { if (error.code === 'ENOENT') break; throw error; }
    if (stat.isSymbolicLink()) throw new Error(`LINK_IN_TEAM_PATH: ${current}`);
  }
  return full;
}

export class TeamStore {
  constructor(dir) {
    this.dir = path.resolve(dir);
    this.stateFile = path.join(this.dir, 'state.json');
    assertInside(path.dirname(this.dir), this.dir);
  }
  path(...parts) { return assertInside(this.dir, path.join(this.dir, ...parts)); }
  exists() { return fs.existsSync(this.stateFile); }
  read() {
    const state = readJson(this.stateFile);
    if (!state) throw new Error(`TEAM_NOT_FOUND: ${this.dir}`);
    return state;
  }
  create(state) {
    withLock(this.dir, () => {
      if (this.exists()) throw new Error('TEAM_EXISTS');
      writeAtomic(this.stateFile, JSON.stringify({ ...state, revision: 1 }, null, 2) + '\n');
    });
    return this.read();
  }
  // Read-modify-write under the lock; mutate returns a new state or mutates in place.
  update(mutate) {
    return withLock(this.dir, () => {
      const before = this.read();
      const draft = structuredClone(before);
      const result = mutate(draft);
      const next = result && typeof result === 'object' && result.state ? result.state : draft;
      next.revision = before.revision + 1;
      writeAtomic(this.stateFile, JSON.stringify(next, null, 2) + '\n');
      return result && result.value !== undefined ? result.value : next;
    });
  }
  log(entry) {
    fs.mkdirSync(this.dir, { recursive: true });
    fs.appendFileSync(path.join(this.dir, 'log.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n');
  }
}
