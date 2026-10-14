// Herdr adapter. Every new agent pane is created through tooling/herdr/grid.cjs; this module
// never splits panes itself. The executor is injectable so tests can use a fake Herdr.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './proc.mjs';

export const GRID_SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../herdr/grid.cjs');

export class HerdrError extends Error {
  constructor(code, detail) { super(`${code}${detail ? `: ${detail}` : ''}`); this.code = code; }
}

// grid.cjs prints progress lines, then a pretty-printed JSON object last.
export function parseGridOutput(stdout) {
  const lines = stdout.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].startsWith('{')) {
      try {
        const value = JSON.parse(lines.slice(i).join('\n'));
        if (typeof value.new_pane_id === 'string' && value.new_pane_id) return value;
      } catch {}
      break;
    }
  }
  throw new HerdrError('GRID_OUTPUT_UNPARSEABLE');
}

export function createHerdr({ exec, herdrBin = 'herdr', timeoutMs = 30000 } = {}) {
  const runner = exec ?? ((file, args, opts) => run(file, args, { timeoutMs, ...opts }));
  async function call(args, opts = {}) {
    const r = await runner(herdrBin, args, opts);
    if (r.timedOut) throw new HerdrError('HERDR_TIMEOUT', args.slice(0, 2).join(' '));
    if (r.code !== 0) throw new HerdrError('HERDR_FAILED', `${args.slice(0, 2).join(' ')}: ${(r.stderr || r.stdout).trim().slice(0, 300)}`);
    try { return JSON.parse(r.stdout).result; } catch { throw new HerdrError('HERDR_BAD_JSON', args.slice(0, 2).join(' ')); }
  }
  const api = {
    async workspaces() { return (await call(['workspace', 'list'])).workspaces; },
    async tabs(workspaceId) { return (await call(['tab', 'list', '--workspace', workspaceId])).tabs; },
    async panes(workspaceId) { return (await call(['pane', 'list', '--workspace', workspaceId])).panes; },
    async pane(paneId) {
      try { return (await call(['pane', 'get', paneId])).pane; } catch (e) { if (e.code === 'HERDR_FAILED' && /not.?found|no such|unknown pane/i.test(e.message)) return null; throw e; }
    },
    async readPane(paneId, lines = 40) { const r = await runner(herdrBin, ['pane', 'read', paneId, '--lines', String(lines)], {}); return r.code === 0 ? r.stdout : ''; },
    async createTab({ workspaceId, label, cwd }) {
      return call(['tab', 'create', '--workspace', workspaceId, '--label', label, '--cwd', cwd, '--no-focus']);
    },
    async closePane(paneId) { return call(['pane', 'close', paneId]); },
    async startAgent({ name, kind, paneId, args, timeoutMs: t = 60000 }) {
      return call(['agent', 'start', name, '--kind', kind, '--pane', paneId, '--timeout', String(t), '--', ...args], { timeoutMs: t + 15000 });
    },
    async agent(target) { return (await call(['agent', 'get', target])).agent; },
    // Submission only: exit 0 means "sent", never "received".
    async prompt(target, text) {
      const r = await runner(herdrBin, ['agent', 'prompt', target, text], {});
      if (r.timedOut) return { outcome: 'unknown', error: 'HERDR_TIMEOUT' };
      if (r.code === 0) return { outcome: 'sent' };
      const detail = (r.stderr || r.stdout).trim().slice(0, 300);
      return { outcome: /agent_blocked/.test(detail) ? 'blocked' : 'failed', error: detail };
    },
    async gridSplit({ workspaceId, tabId, cwd, name, node = process.execPath, script = GRID_SCRIPT }) {
      const r = await runner(node, [script, 'split', '--tab', `${tabId}`, '--workspace', workspaceId, '--cwd', cwd, '--name', name], { timeoutMs: 120000 });
      if (r.timedOut) throw new HerdrError('GRID_TIMEOUT');
      if (r.code !== 0) throw new HerdrError('GRID_FAILED', (r.stderr || r.stdout).trim().slice(0, 300));
      return parseGridOutput(r.stdout);
    },
  };
  return api;
}

const match = (token, id, label) => id === token || (label && label.toLowerCase() === String(token).toLowerCase());

// Space: explicit (id or name) or the caller's own HERDR_WORKSPACE_ID. Never guessed from focus.
export async function resolveSpace(herdr, explicit, env = process.env) {
  const token = explicit ?? env.HERDR_WORKSPACE_ID;
  if (!token) throw new HerdrError('SPACE_NOT_SPECIFIED', 'pass --space or run inside Herdr');
  const ws = (await herdr.workspaces()).find(w => match(token, w.workspace_id, w.label));
  if (!ws) throw new HerdrError('SPACE_NOT_FOUND', token);
  return { workspaceId: ws.workspace_id, label: ws.label, source: explicit ? 'explicit' : 'caller' };
}

export async function resolveTab(herdr, workspaceId, token) {
  const tab = (await herdr.tabs(workspaceId)).find(t => match(token, t.tab_id, t.label) || t.tab_id === `${workspaceId}:${token}`);
  if (!tab) throw new HerdrError('TAB_NOT_FOUND', token);
  return { tabId: tab.tab_id, label: tab.label };
}

export const paneName = (member, roleTitle, taskName, model) => `${member} ${roleTitle}｜${taskName}${model ? `｜${model}` : ''}`.slice(0, 80);
