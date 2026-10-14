// Team configuration: open role definitions, a single configurable PM and per-role model lists.
import fs from 'node:fs';

const ROLE_ID = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/;
const TEXT_FIELDS = ['displayName', 'purpose', 'instructions'];
const LIST_FIELDS = ['responsibilities', 'deliverables'];
// Only this metric is implemented; other units are rejected rather than misread as percent.
export const SUPPORTED_METRICS = new Set(['quotaRemainingPercent']);
const has = (obj, key) => obj !== null && typeof obj === 'object' && Object.hasOwn(obj, key);

export class ConfigError extends Error {
  constructor(code, detail) { super(`${code}${detail ? `: ${detail}` : ''}`); this.code = code; }
}

export function loadConfig(file) {
  let config;
  try { config = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) {
    throw new ConfigError(error.code === 'ENOENT' ? 'CONFIG_NOT_FOUND' : 'CONFIG_INVALID_JSON', file);
  }
  validateConfig(config);
  return config;
}

function validateEntry(entry, where, providers) {
  if (!entry || typeof entry !== 'object') throw new ConfigError('MODEL_ENTRY_INVALID', where);
  if (typeof entry.provider !== 'string' || !entry.provider) throw new ConfigError('MODEL_ENTRY_MISSING_PROVIDER', where);
  if (typeof entry.model !== 'string' || !entry.model) throw new ConfigError('MODEL_ENTRY_MISSING_MODEL', where);
  if (!has(providers, entry.provider)) throw new ConfigError('MODEL_ENTRY_UNKNOWN_PROVIDER', `${where} ${entry.provider}`);
  if (typeof entry.enabled !== 'boolean') throw new ConfigError('MODEL_ENTRY_INVALID_ENABLED', where);
  const t = entry.remainingThreshold;
  if (!t || typeof t.metric !== 'string' || typeof t.value !== 'number' || !Number.isFinite(t.value)) throw new ConfigError('MODEL_ENTRY_INVALID_THRESHOLD', where);
  if (!SUPPORTED_METRICS.has(t.metric)) throw new ConfigError('MODEL_ENTRY_UNSUPPORTED_METRIC', `${where} ${t.metric}`);
  if (t.value > 100) throw new ConfigError('MODEL_ENTRY_INVALID_THRESHOLD', `${where} percent > 100`);
}

export function validateConfig(config) {
  if (!config || typeof config !== 'object') throw new ConfigError('CONFIG_INVALID');
  const providers = config.providers;
  if (!providers || typeof providers !== 'object') throw new ConfigError('CONFIG_MISSING_PROVIDERS');
  for (const [id, p] of Object.entries(providers)) {
    if (typeof p.enabled !== 'boolean') throw new ConfigError('PROVIDER_INVALID_ENABLED', id);
  }
  validateEntry(config.defaultModel, 'defaultModel', providers);
  const roles = config.roles;
  if (!roles || typeof roles !== 'object' || Array.isArray(roles)) throw new ConfigError('CONFIG_MISSING_ROLES');
  for (const [roleId, role] of Object.entries(roles)) validateRole(roleId, role, providers);
  const pm = config.coordination?.pmRoleId;
  if (typeof pm !== 'string' || !has(roles, pm)) throw new ConfigError('PM_ROLE_NOT_DEFINED', String(pm));
  if (roles[pm].enabled !== true) throw new ConfigError('PM_ROLE_DISABLED', pm);
  return config;
}

export function validateRole(roleId, role, providers) {
  if (!ROLE_ID.test(roleId)) throw new ConfigError('ROLE_ID_INVALID', roleId);
  if (!role || typeof role !== 'object') throw new ConfigError('ROLE_INVALID', roleId);
  for (const f of TEXT_FIELDS) if (typeof role[f] !== 'string' || !role[f].trim()) throw new ConfigError('ROLE_FIELD_MISSING', `${roleId}.${f}`);
  for (const f of LIST_FIELDS) if (!Array.isArray(role[f]) || !role[f].length || role[f].some(x => typeof x !== 'string' || !x.trim())) throw new ConfigError('ROLE_FIELD_MISSING', `${roleId}.${f}`);
  if (typeof role.enabled !== 'boolean') throw new ConfigError('ROLE_FIELD_MISSING', `${roleId}.enabled`);
  if (role.models !== undefined) {
    if (!Array.isArray(role.models)) throw new ConfigError('ROLE_MODELS_INVALID', roleId);
    role.models.forEach((entry, i) => validateEntry(entry, `${roleId}.models[${i}]`, providers));
  }
}

// §6.2: only a defined, enabled role with no models (missing or []) copies defaultModel.
export function effectiveModels(config, roleId) {
  if (!has(config.roles, roleId)) throw new ConfigError('ROLE_NOT_DEFINED', roleId);
  const role = config.roles[roleId];
  if (role.enabled !== true) throw new ConfigError('ROLE_DISABLED', roleId);
  if (role.models === undefined || role.models.length === 0) return [{ ...structuredClone(config.defaultModel), source: 'defaultModel' }];
  return role.models.map((entry, index) => ({ ...structuredClone(entry), source: `${roleId}.models[${index}]` }));
}

export const roleDefined = (config, roleId) => has(config.roles, roleId);

export function enabledRoles(config) {
  return Object.entries(config.roles).filter(([, r]) => r.enabled === true).map(([id]) => id);
}
