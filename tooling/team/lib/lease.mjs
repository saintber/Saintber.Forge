// Operation leases: one live owner per (kind, key) for operations that span awaits (launch,
// handoff). The state lock is NOT held across network calls; instead a short lock only registers
// or releases the lease. A second caller sees the live owner and gets { busy } without calling
// Herdr or any CLI again. A lease whose owner process is gone is dead: the caller takes over and
// resumes from the journal (the member's launch step / handoff phase), never from scratch.
//
// Owner identity is pid + nonce. Two promises in one process share a pid, so the nonce (not the pid)
// decides who owns it; the pid only tells whether the owner can still be running.
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { readJson, writeAtomic, withLock, processAlive } from './store.mjs';

const file = teamDir => path.join(teamDir, 'operations.json');
const lockDir = teamDir => path.join(teamDir, 'operations-lock');
const idOf = (kind, key) => `${kind}:${key}`;

export class OperationBusy extends Error {
  constructor(kind, key, owner) { super(`OPERATION_IN_PROGRESS: ${kind} ${key} (pid ${owner.pid})`); this.code = 'OPERATION_IN_PROGRESS'; this.owner = owner; }
}

// Registers the lease or reports the live owner. isAlive is injectable for tests.
export function acquire(teamDir, kind, key, { isAlive = processAlive, pid = process.pid } = {}) {
  return withLock(lockDir(teamDir), () => {
    const data = readJson(file(teamDir), { leases: {} });
    const id = idOf(kind, key);
    const held = data.leases[id];
    if (held && isAlive(held.pid)) return { acquired: false, owner: held };
    const lease = { kind, key, pid, nonce: randomUUID(), since: new Date().toISOString(), tookOver: Boolean(held) };
    data.leases[id] = lease;
    writeAtomic(file(teamDir), JSON.stringify(data, null, 2) + '\n');
    return { acquired: true, lease, tookOver: Boolean(held) };
  });
}

// Releases only if this nonce still owns the lease.
export function release(teamDir, lease) {
  return withLock(lockDir(teamDir), () => {
    const data = readJson(file(teamDir), { leases: {} });
    const id = idOf(lease.kind, lease.key);
    if (data.leases[id]?.nonce !== lease.nonce) return false;
    delete data.leases[id];
    writeAtomic(file(teamDir), JSON.stringify(data, null, 2) + '\n');
    return true;
  });
}

export const holders = teamDir => readJson(file(teamDir), { leases: {} }).leases;

// Runs fn under the lease. Busy => { busy: true, owner } without calling fn. The lease is always
// released in finally, also when fn throws.
export async function withOperation(teamDir, kind, key, fn, options) {
  const got = acquire(teamDir, kind, key, options);
  if (!got.acquired) return { busy: true, owner: got.owner };
  try { return { busy: false, value: await fn({ tookOver: got.tookOver }), tookOver: got.tookOver }; }
  finally { release(teamDir, got.lease); }
}
