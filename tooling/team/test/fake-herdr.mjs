// In-memory Herdr used through the real adapter (createHerdr) via an injected exec, so the
// argv sent to herdr and to grid.cjs is what is under test.
import path from 'node:path';
import { createHerdr, GRID_SCRIPT } from '../lib/herdr.mjs';

export function fakeHerdrWorld() {
  const world = {
    workspaces: [{ workspace_id: 'w1', label: 'Main' }, { workspace_id: 'w3', label: 'Personal' }],
    tabs: [{ tab_id: 'w3:t1', label: 'Existing', workspace_id: 'w3' }],
    panes: [{ pane_id: 'w3:p1', tab_id: 'w3:t1', label: 'user', agent: 'claude', agent_status: 'idle' }],
    prompts: [], gridCalls: [], closed: [], started: [], seq: 10,
    failGridOnce: false, gridCreatesThenFails: false, promptOutcome: () => 'sent', onPrompt: null, processes: {}, sessionDelayReads: 0, failAfterStart: false, gridDelayMs: 0, startDelayMs: 0,
  };
  const ok = result => ({ code: 0, stdout: JSON.stringify({ result }), stderr: '' });
  const exec = async (file, args) => {
    if (args[0] === GRID_SCRIPT || (file === process.execPath && path.basename(args[0] ?? '') === 'grid.cjs')) {
      world.gridCalls.push(args.slice(1));
      if (world.gridDelayMs) await new Promise(r => setTimeout(r, world.gridDelayMs));
      if (world.failGridOnce) { world.failGridOnce = false; return { code: 1, stdout: '', stderr: 'boom' }; }
      const tab = args[args.indexOf('--tab') + 1];
      const name = args[args.indexOf('--name') + 1];
      const pane = { pane_id: `${tab.split(':')[0]}:p${++world.seq}`, tab_id: tab, label: name, agent: null, agent_status: 'unknown' };
      world.panes.push(pane);
      if (world.gridCreatesThenFails) { world.gridCreatesThenFails = false; return { code: 1, stdout: '[herdr-grid] partial', stderr: 'equalize failed' }; }
      return { code: 0, stdout: `[herdr-grid] (新增欄) 1 -> 1:1\n${JSON.stringify({ new_pane_id: pane.pane_id, name, action: 'add-column' }, null, 2)}\n`, stderr: '' };
    }
    const [a, b, ...rest] = args;
    const key = `${a} ${b}`;
    if (key === 'workspace list') return ok({ workspaces: world.workspaces });
    if (key === 'tab list') { const ws = rest[1]; return ok({ tabs: world.tabs.filter(t => t.workspace_id === ws) }); }
    if (key === 'tab create') {
      const ws = rest[rest.indexOf('--workspace') + 1]; const label = rest[rest.indexOf('--label') + 1];
      if (!rest.includes('--no-focus')) throw new Error('tab create must use --no-focus');
      const tab = { tab_id: `${ws}:t${++world.seq}`, label, workspace_id: ws };
      const root = { pane_id: `${ws}:p${++world.seq}`, tab_id: tab.tab_id, label: 'root', agent: null, agent_status: 'unknown' };
      world.tabs.push(tab); world.panes.push(root);
      return ok({ tab, root_pane: root });
    }
    if (key === 'pane list') return ok({ panes: world.panes });
    const tickSession = id => { const q = world.panes.find(x => x.pane_id === id); if (q?.pendingSession && --q.pendingSession.reads <= 0) { q.agent_session = { value: q.pendingSession.value }; delete q.pendingSession; } };
    if (key === 'pane get') { tickSession(rest[0]); }
    if (key === 'pane get') { const p = world.panes.find(x => x.pane_id === rest[0]); return p ? ok({ pane: p }) : { code: 1, stdout: '', stderr: 'pane not found' }; }
    if (key === 'pane read') return { code: 0, stdout: world.panes.find(x => x.pane_id === rest[0])?.screen ?? '', stderr: '' };
    if (key === 'pane process-info') { const id = rest[rest.indexOf('--pane') + 1]; return ok({ process_info: { pane_id: id, foreground_processes: world.processes[id] ?? [] } }); }
    if (key === 'pane close') { const closing = world.panes.find(p => p.pane_id === rest[0]); world.closed.push(rest[0]); world.panes = world.panes.filter(p => p.pane_id !== rest[0]);
      if (closing && !world.panes.some(p => p.tab_id === closing.tab_id)) { world.tabs = world.tabs.filter(t => t.tab_id !== closing.tab_id); world.closedTabs = [...(world.closedTabs ?? []), closing.tab_id]; }
      return ok({}); }
    if (key === 'agent start') {
      if (world.startDelayMs) await new Promise(r => setTimeout(r, world.startDelayMs));
      const pane = world.panes.find(p => p.pane_id === rest[rest.indexOf('--pane') + 1]);
      const kind = rest[rest.indexOf('--kind') + 1];
      world.started.push({ pane: pane.pane_id, kind, name: rest[0], args: rest.slice(rest.indexOf('--') + 1) });
      pane.agent_name = rest[0];
      pane.agent = kind; pane.agent_status = 'idle';
      pane.pendingSession = { value: `sess-${pane.pane_id}`, reads: world.sessionDelayReads };
      if (!pane.pendingSession.reads) { pane.agent_session = pane.pendingSession; delete pane.pendingSession; }
      if (world.failAfterStart) { world.failAfterStart = false; return { code: null, stdout: '', stderr: '', timedOut: true }; } // started, but the call was interrupted
      return ok({ agent: { pane_id: pane.pane_id } });
    }
    if (key === 'agent get') { tickSession(rest[0]); }
    if (key === 'agent get') { const p = world.panes.find(x => x.pane_id === rest[0]); return p ? ok({ agent: { pane_id: p.pane_id, agent_status: p.agent_status, agent: p.agent, agent_session: p.agent_session, ...(p.agent_name ? { name: p.agent_name } : {}) } }) : { code: 1, stdout: '', stderr: 'not found' }; }
    if (key === 'agent prompt') {
      const outcome = world.promptOutcome(rest[0], rest[1]);
      if (outcome === 'timeout') return { code: null, stdout: '', stderr: '', timedOut: true };
      if (outcome === 'blocked') return { code: 1, stdout: '', stderr: 'agent_blocked' };
      if (outcome === 'failed') return { code: 1, stdout: '', stderr: 'boom' };
      world.prompts.push({ target: rest[0], text: rest[1] });
      if (world.onPrompt) world.onPrompt(rest[0], rest[1]);
      return ok({ type: 'agent_prompted' });
    }
    return { code: 2, stdout: '', stderr: `fake: unsupported ${key}` };
  };
  world.herdr = createHerdr({ exec: async (f, a, o) => ({ timedOut: false, ...(await exec(f, a, o)) }) });
  return world;
}
