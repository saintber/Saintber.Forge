// Wires real provider state into entry selection (§6.3): disabled providers, missing CLI,
// auth mode, observed quota and exhausted pools decide the starting cursor for a member.
import { effectiveModels } from './config.mjs';
import { selectEntry, normalise } from './models.mjs';
import { checkAuth, observe } from './providers.mjs';

// Per-pass cache so the same provider is probed at most once and disabled providers never.
// observeFn(provider, observeDeps) defaults to the real adapters; tests inject a pure function.
export function createProviderState({ config, authDeps, observeDeps, observations = {}, observeFn = observe }) {
  const auth = new Map();
  const seen = new Map(Object.entries(observations));
  return {
    async auth(providerId) {
      if (!auth.has(providerId)) auth.set(providerId, await checkAuth(config.providers[providerId], authDeps));
      return auth.get(providerId);
    },
    async observation(providerId, { probe = true, refresh = false } = {}) {
      if (seen.has(providerId) && !refresh) return seen.get(providerId);
      const provider = config.providers[providerId];
      if (!probe || provider.enabled !== true) return null; // no probing of disabled providers
      // The latest probe is returned as-is (unknown stays unknown). What must survive an unknown
      // probe is the persisted pool limit / member lastObservation in team state, not this cache.
      const obs = await observeFn(provider, observeDeps);
      seen.set(providerId, obs);
      return obs;
    },
    observations: () => Object.fromEntries(seen),
  };
}

// Returns { index, entry, status } or { index: -1, reasons }; `from` keeps the cursor moving forward.
export async function chooseEntry({ config, roleId, from = 0, providerState, exhaustedPools = new Set(), probe = true }) {
  const entries = effectiveModels(config, roleId);
  const authByProvider = {};
  const obsByProvider = {};
  for (const entry of entries.slice(from)) {
    const provider = config.providers[entry.provider];
    if (!entry.enabled || provider?.enabled !== true) continue;
    if (!(entry.provider in authByProvider)) authByProvider[entry.provider] = await providerState.auth(entry.provider);
    if (!(entry.provider in obsByProvider)) obsByProvider[entry.provider] = authByProvider[entry.provider].ok ? await providerState.observation(entry.provider, { probe }) : null;
  }
  // Pools come from the caller's persisted limits plus what THIS pass just observed.
  const pools = new Set(exhaustedPools);
  for (const [providerId, obs] of Object.entries(obsByProvider)) {
    if (obs && normalise(obs).limit && config.providers[providerId]?.quotaPool) pools.add(config.providers[providerId].quotaPool);
  }
  return selectEntry(entries, {
    from, providers: config.providers, exhaustedPools: pools,
    canLaunch: entry => { const a = authByProvider[entry.provider]; return a?.ok === true ? true : (a?.reason ?? 'AUTH_UNCHECKED'); },
    observe: entry => obsByProvider[entry.provider] ?? null,
  });
}

export const poolOf = (config, entry) => entry.quotaPool ?? config.providers[entry.provider]?.quotaPool ?? null;

// Pools known exhausted: persisted limits (survive ticks and restarts) plus this pass's reliable
// observations. Unknown data never removes a persisted limit; only recordRecovery does.
export function exhaustedPoolsFrom(config, observations, options, persisted = {}) {
  const pools = new Set(Object.keys(persisted));
  for (const [providerId, obs] of Object.entries(observations)) {
    if (!normalise(obs, options).limit) continue;
    const provider = config.providers[providerId];
    if (provider?.quotaPool) pools.add(provider.quotaPool);
  }
  return pools;
}
