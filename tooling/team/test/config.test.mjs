import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateConfig, effectiveModels, loadConfig, ConfigError } from '../lib/config.mjs';

const exampleUrl = new URL('../config/team.example.json', import.meta.url);
const example = () => JSON.parse(fs.readFileSync(exampleUrl, 'utf8'));
const code = fn => { try { fn(); } catch (e) { assert.ok(e instanceof ConfigError, e.message); return e.code; } assert.fail('expected ConfigError'); };

test('example config and design attachment both validate with seven open roles', () => {
  const config = loadConfig(exampleUrl);
  assert.deepEqual(Object.keys(config.roles), ['PM', 'SA1', 'SA2', 'SD1', 'SD2', 'PG', 'QA']);
  loadConfig(new URL('../../../docs/proposals/task-team-config.example.json', import.meta.url));
});

test('a new custom role needs no code change and keeps its own content', () => {
  const config = example();
  config.roles.Translator = { displayName: '翻譯', purpose: '翻譯文件', responsibilities: ['翻譯'], instructions: '只翻譯。', deliverables: ['譯文'], enabled: true };
  validateConfig(config);
  const models = effectiveModels(config, 'Translator');
  assert.equal(models.length, 1);
  assert.equal(models[0].source, 'defaultModel');
  assert.equal(models[0].model, config.defaultModel.model);
});

test('defaultModel only for defined, enabled roles with missing or empty models', () => {
  const config = example();
  assert.equal(effectiveModels(config, 'SD2')[0].source, 'defaultModel');
  assert.equal(code(() => effectiveModels(config, 'QA')), 'ROLE_DISABLED');
  assert.equal(code(() => effectiveModels(config, 'Nobody')), 'ROLE_NOT_DEFINED');
  config.roles.SA1.models.forEach(m => { m.enabled = false; });
  const list = effectiveModels(config, 'SA1');
  assert.ok(list.every(m => m.source.startsWith('SA1.')), 'all-disabled list must not fall back to default');
});

test('thresholds are copied per entry, not shared', () => {
  const config = example();
  const sa1 = effectiveModels(config, 'SA1').find(m => m.model === 'gpt-6.1-sol');
  const sa2 = effectiveModels(config, 'SA2').find(m => m.model === 'gpt-6.1-sol');
  assert.equal(sa1.remainingThreshold.value, 50);
  assert.equal(sa2.remainingThreshold.value, 70);
  sa1.remainingThreshold.value = 1;
  assert.equal(config.roles.SA1.models.find(m => m.model === 'gpt-6.1-sol').remainingThreshold.value, 50);
});

test('configuration errors are errors, not "no model"', () => {
  let config = example(); delete config.roles.PG.models[0].model;
  assert.equal(code(() => validateConfig(config)), 'MODEL_ENTRY_MISSING_MODEL');
  config = example(); delete config.roles.PG.models[0].provider;
  assert.equal(code(() => validateConfig(config)), 'MODEL_ENTRY_MISSING_PROVIDER');
  config = example(); config.coordination.pmRoleId = 'Boss';
  assert.equal(code(() => validateConfig(config)), 'PM_ROLE_NOT_DEFINED');
  config = example(); config.roles.PM.enabled = false;
  assert.equal(code(() => validateConfig(config)), 'PM_ROLE_DISABLED');
  config = example(); delete config.roles.SA1.responsibilities;
  assert.equal(code(() => validateConfig(config)), 'ROLE_FIELD_MISSING');
  config = example(); config.roles['bad id;rm'] = config.roles.SA1;
  assert.equal(code(() => validateConfig(config)), 'ROLE_ID_INVALID');
});

test('PM role id is configurable', () => {
  const config = example();
  config.roles.Lead = { ...config.roles.PM };
  config.coordination.pmRoleId = 'Lead';
  validateConfig(config);
});

test('unsupported metrics, out-of-range percents and inherited names are rejected', () => {
  let config = example(); config.roles.PG.models[0].remainingThreshold.metric = 'usd';
  assert.equal(code(() => validateConfig(config)), 'MODEL_ENTRY_UNSUPPORTED_METRIC');
  config = example(); config.roles.PG.models[0].remainingThreshold.value = 101;
  assert.equal(code(() => validateConfig(config)), 'MODEL_ENTRY_INVALID_THRESHOLD');
  config = example(); config.roles.PG.models[0].remainingThreshold.value = Infinity;
  assert.equal(code(() => validateConfig(config)), 'MODEL_ENTRY_INVALID_THRESHOLD');
  config = example(); config.roles.PG.models[0].provider = 'constructor';
  assert.equal(code(() => validateConfig(config)), 'MODEL_ENTRY_UNKNOWN_PROVIDER');
  config = example(); config.coordination.pmRoleId = 'toString';
  assert.equal(code(() => validateConfig(config)), 'PM_ROLE_NOT_DEFINED');
  assert.equal(code(() => effectiveModels(example(), 'constructor')), 'ROLE_NOT_DEFINED');
});
