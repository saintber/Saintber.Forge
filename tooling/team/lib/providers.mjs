// Provider adapters: launch argv with the explicitly selected model, authentication pre-checks
// and quota observation. No adapter sends an inference request to learn about quota.
import { run, resolveCommand } from './proc.mjs';
import { spawn } from 'node:child_process';

const PROBE_TIMEOUT = 20000;

export class ProviderError extends Error {
  constructor(code, detail) { super(`${code}${detail ? `: ${detail}` : ''}`); this.code = code; }
}

// --- launch arguments ---------------------------------------------------------------------
// Claude: never pass --fallback-model; permission additions come from a per-session settings file.
// Codex / Gemini: model flag only; no automatic model fallback is enabled.
export function launchArgs(provider, entry, { settingsFile, appendPrompt } = {}) {
  if (/[\r\n]/.test(entry.model)) throw new ProviderError('MODEL_INVALID', entry.model);
  switch (provider.cli) {
    case 'claude': {
      const args = ['--model', entry.model];
      if (settingsFile) args.push('--settings', settingsFile);
      if (appendPrompt) args.push('--append-system-prompt', appendPrompt);
      return { kind: 'claude', args };
    }
    case 'codex': return { kind: 'codex', args: ['-m', entry.model] };
    case 'gemini': return { kind: 'gemini', args: ['-m', entry.model] };
    default: throw new ProviderError('PROVIDER_CLI_UNSUPPORTED', provider.cli);
  }
}

// The model a running agent reports must match the configured entry; otherwise report to PM.
export function modelMatches(entry, reported) {
  if (!reported) return 'unknown';
  return reported === entry.model ? 'match' : 'mismatch';
}

// --- authentication pre-checks ------------------------------------------------------------
// Only the mode is extracted; account names, emails or tokens are never returned or logged.
export async function checkAuth(provider, { exec = run, resolve = resolveCommand, env = process.env } = {}) {
  if (provider.enabled !== true) return { ok: false, reason: 'PROVIDER_DISABLED' }; // no probe for disabled providers
  const cmd = resolve(provider.cli, env);
  if (!cmd) return { ok: false, reason: 'CLI_NOT_FOUND' };
  if (provider.cli === 'codex') {
    const r = await exec(cmd.file, [...cmd.prefix, 'login', 'status'], { timeoutMs: PROBE_TIMEOUT });
    if (r.timedOut) return { ok: false, reason: 'AUTH_PROBE_TIMEOUT' };
    const text = `${r.stdout}\n${r.stderr}`;
    const mode = /ChatGPT/i.test(text) ? 'chatgpt' : /API key/i.test(text) ? 'api-key' : r.code === 0 ? 'unknown' : 'logged-out';
    if (provider.authentication === 'chatgpt-subscription' && mode !== 'chatgpt') return { ok: false, reason: 'AUTH_MODE_MISMATCH', mode };
    return { ok: mode !== 'logged-out', mode };
  }
  if (provider.cli === 'gemini') {
    // Subscription mode must not silently become API billing because a key exists in the env.
    if (provider.authentication === 'google-subscription' && (env.GEMINI_API_KEY || env.GOOGLE_API_KEY)) return { ok: false, reason: 'AUTH_MODE_AMBIGUOUS_API_KEY_PRESENT' };
    return { ok: true, mode: 'unverified' };
  }
  // Claude uses the existing CLI configuration (company); nothing is read here.
  return { ok: true, mode: 'existing-cli-configuration' };
}

// --- quota observation --------------------------------------------------------------------
// Codex: app-server account/rateLimits/read. Read-only; no model turn is started.
export function codexObservation(result, at) {
  const limits = result?.rateLimits;
  if (!limits) return { at, reliable: false };
  const windows = [limits.primary, limits.secondary].filter(Boolean).map(w => ({ usedPercent: w.usedPercent, resetsAt: w.resetsAt }));
  const signal = limits.rateLimitReachedType ? 'quota-exhausted' : null;
  return { at, reliable: windows.length > 0, windows, signal, source: 'codex:account/rateLimits/read' };
}

export function readCodexRateLimits({ resolve = resolveCommand, env = process.env, timeoutMs = PROBE_TIMEOUT, spawnFn = spawn } = {}) {
  const cmd = resolve('codex', env);
  if (!cmd) return Promise.resolve({ error: 'CLI_NOT_FOUND' });
  return new Promise(done => {
    const child = spawnFn(cmd.file, [...cmd.prefix, 'app-server'], { stdio: ['pipe', 'pipe', 'ignore'], shell: false, windowsHide: true });
    let buffer = '', finished = false;
    const finish = value => { if (finished) return; finished = true; clearTimeout(timer); try { child.kill(); } catch {} done(value); };
    const timer = setTimeout(() => finish({ error: 'TIMEOUT' }), timeoutMs);
    child.on('error', e => finish({ error: e.code || 'SPAWN_FAILED' }));
    child.stdout.on('data', chunk => {
      buffer += chunk;
      let i;
      while ((i = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, i); buffer = buffer.slice(i + 1);
        let msg; try { msg = JSON.parse(line); } catch { continue; }
        if (msg.id === 0) {
          child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
          child.stdin.write(JSON.stringify({ id: 1, method: 'account/rateLimits/read' }) + '\n');
        } else if (msg.id === 1) finish(msg.error ? { error: 'RPC_ERROR' } : { result: msg.result });
      }
    });
    child.stdin.write(JSON.stringify({ id: 0, method: 'initialize', params: { clientInfo: { name: 'task-team', version: '1.0.0' } } }) + '\n');
  });
}

// Claude (company Azure) and Gemini: no machine-readable quota adapter here. A missing value is
// unknown; manual or status-line observations can be recorded with `team usage`.
export async function observe(provider, { codexReader = readCodexRateLimits, now = new Date().toISOString() } = {}) {
  if (provider.enabled !== true) return null;
  if (provider.cli === 'codex') {
    const r = await codexReader();
    return r.result ? codexObservation(r.result, now) : { at: now, reliable: false, error: r.error };
  }
  return { at: now, reliable: false, source: `${provider.cli}:no-quota-adapter` };
}
