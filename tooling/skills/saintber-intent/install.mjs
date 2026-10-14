import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const sourceDir = path.dirname(fileURLToPath(import.meta.url));
// Git may convert tracked text to CRLF on checkout; that is not a local edit.
const sha = text => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
const registryPath = '.agents/skills/saintber-intent/installation.json';
const paths = ['.agents/skills/saintber-intent/SKILL.md', '.claude/skills/saintber-intent/SKILL.md', '.gemini/commands/saintber-intent.toml'];

export function outputs(source) {
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!frontmatter || !/^name: saintber-intent$/m.test(frontmatter[1]) || !/^description: .+/m.test(frontmatter[1])) throw new Error('INVALID_SKILL');
  const body = source.slice(frontmatter[0].length).trim();
  if (body.includes("'''") || body.includes('!{') || body.includes('@{') || body.includes('{{args}}')) throw new Error('UNSAFE_GEMINI_TEMPLATE');
  const gemini = `# Generated from tooling/skills/saintber-intent/SKILL.md; edit the source and reinstall.\ndescription = "建立或修訂需求分析稿，判斷修訂與承接關係"\nprompt = '''\n${body}\n\n使用者本次的輸入：\n{{args}}\n'''\n`;
  return new Map([[paths[0], source], [paths[1], source], [paths[2], gemini]]);
}

function checkPath(root, relative, file = true) {
  const parts = relative.split('/');
  let current = root;
  for (let index = 0; index < parts.length; index++) {
    current = path.join(current, parts[index]);
    if (!fs.existsSync(current)) {
      // Broken symlinks must not look like missing paths.
      try { fs.lstatSync(current); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    }
    let stat;
    try { stat = fs.lstatSync(current); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (stat.isSymbolicLink()) throw new Error(`LINK_PATH: ${relative}`);
    const last = index === parts.length - 1;
    if (last && file ? !stat.isFile() : !stat.isDirectory()) throw new Error(`INVALID_PATH_TYPE: ${relative}`);
  }
  return path.join(root, ...parts);
}

const read = file => {
  try { return fs.readFileSync(file, 'utf8'); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
};

export function install(projectDirectory, source = fs.readFileSync(path.join(sourceDir, 'SKILL.md'), 'utf8')) {
  const root = path.resolve(projectDirectory);
  if (!fs.existsSync(root) || !fs.lstatSync(root).isDirectory() || fs.lstatSync(root).isSymbolicLink()) throw new Error('INVALID_PROJECT_DIRECTORY');
  const canonical = fs.realpathSync(root);
  const normalize = value => process.platform === 'win32' ? value.toLowerCase() : value;
  if (normalize(canonical) !== normalize(root)) throw new Error('LINK_PROJECT_DIRECTORY');
  // No Spec Kit dependency; explicit local governance establishes the target.
  for (const required of ['AGENTS.md', 'docs/governance/policy/README.md']) {
    if (read(checkPath(root, required)) === null) throw new Error(`MISSING_PROJECT_GOVERNANCE: ${required}`);
  }
  const wanted = outputs(source);
  const registryFile = checkPath(root, registryPath);
  const registryBefore = read(registryFile);
  let prior = { schemaVersion: 1, hashes: {} };
  if (registryBefore !== null) {
    try { prior = JSON.parse(registryBefore); } catch { throw new Error('INVALID_INSTALLATION_REGISTRY'); }
    if (prior.schemaVersion !== 1 || !prior.hashes || typeof prior.hashes !== 'object' || Array.isArray(prior.hashes) || Object.keys(prior.hashes).some(key => !paths.includes(key)) || Object.values(prior.hashes).some(value => typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value))) throw new Error('INVALID_INSTALLATION_REGISTRY');
  }
  const pending = [];
  // Check every destination before any mutation; refuse unmanaged/local edits.
  for (const [relative, content] of wanted) {
    const file = checkPath(root, relative);
    const before = read(file);
    if (before !== null && before !== content && (!prior.hashes[relative] || sha(before) !== prior.hashes[relative])) throw new Error(`LOCAL_CHANGES: ${relative}`);
    pending.push({ relative, file, before, content });
  }
  const result = [];
  for (const item of pending) {
    checkPath(root, item.relative);
    if (read(item.file) !== item.before) throw new Error(`CONCURRENT_CHANGE: ${item.relative}`);
    if (item.before === item.content) { result.push({ path: item.relative, action: 'unchanged' }); continue; }
    fs.mkdirSync(path.dirname(item.file), { recursive: true });
    fs.writeFileSync(item.file, item.content, { encoding: 'utf8', flag: item.before === null ? 'wx' : 'w' });
    result.push({ path: item.relative, action: item.before === null ? 'created' : 'updated' });
  }
  const next = JSON.stringify({ schemaVersion: 1, hashes: Object.fromEntries([...wanted].map(([relative, content]) => [relative, sha(content)])) }, null, 2) + '\n';
  checkPath(root, registryPath);
  if (read(registryFile) !== registryBefore) throw new Error('CONCURRENT_REGISTRY_CHANGE');
  if (registryBefore !== next) {
    fs.mkdirSync(path.dirname(registryFile), { recursive: true });
    fs.writeFileSync(registryFile, next, { encoding: 'utf8', flag: registryBefore === null ? 'wx' : 'w' });
  }
  return { projectDirectory: root, entries: result };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log('node tooling/skills/saintber-intent/install.mjs --project-dir <project-root>\nInstall only saintber-intent for Codex, Claude and Gemini; preserve local edits.');
  } else if (args.length === 2 && args[0] === '--project-dir') {
    try { console.log(JSON.stringify(install(args[1]), null, 2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
  } else {
    console.error('Usage: node tooling/skills/saintber-intent/install.mjs --project-dir <project-root>');
    process.exitCode = 1;
  }
}
