// Recognises a REAL quota limit in the visible text of a role's pane, without sending any prompt.
// Used when a provider has no numeric quota adapter (Claude company Azure, Gemini) and when the PM
// itself is the exhausted one and cannot answer a manual `usage` command.
//
// Three outcomes besides "unknown":
//   quota-exhausted : a MODEL USAGE window is used up (session / weekly / Opus / Sonnet limit).
//                     This is what threshold rules act on (switch to the next entry, or wait).
//   budget-blocked  : a spend / budget / credit stop. The design says a money limit only pauses and
//                     reports; it is never a model selector and never spends another account's quota.
//   non-quota errors: 429 throttling, 529 overload, auth, network, context window. Never a model change.
// Anything not recognised stays unknown: we do not guess.
// Wording source: https://code.claude.com/docs/en/errors (checked 2026-10-15, Claude Code 2.1.300).
export const QUOTA_PATTERNS = [
  /You've hit your (?:session|weekly|Opus|Sonnet) limit/,
];

export const BUDGET_PATTERNS = [
  /You've hit your (?:monthly spend|individual spend|individual usage) limit/,
  /You've hit your (?:org's|channel's) monthly spend limit/,
  /You've hit your team's shared budget/,
  /Credit balance is too low/,
];

// Looks like a limit but is not the account's quota.
// The gateway refuses this model for this key (403 "Model is blocked", "can only access models=[...]").
// It is neither a quota limit nor a login problem: do not switch accounts, do not log in again, do not
// change keys. The member is reported to the PM so the configuration owner can fix access or the list.
export const MODEL_BLOCKED_PATTERNS = [
  /Model is blocked/i,
  /This key can only access models/i,
  /PermissionDeniedError.*model/i,
];

export const NON_QUOTA_PATTERNS = [
  ['rate-limited', /Request rejected \(429\)|temporarily limiting requests|not your usage limit|rate limit configured for your API key/i],
  ['overloaded', /\b529\b|Overloaded/i],
  ['auth', /Invalid API key|please run \/login|OAuth token has expired|not logged in/i],
  ['network', /ECONNRESET|ETIMEDOUT|ENOTFOUND|getaddrinfo|network (?:error|is unreachable)|connection (?:lost|refused|reset)/i],
  ['context-full', /prompt is too long|conversation is too long|Context limit reached/i],
];

// Provider error UI is a short block at the very end of the screen: the message is the last
// non-empty content, optionally followed by the input prompt box. Work output (a document being
// written, code, a quoted example, test fixtures) is ordinary lines that do not END the screen with
// such a message, and quoted/indented/commented text is not accepted.
const UI_MARK = /^(?:[⎿✗✘✖!⚠●]\s*|API Error:\s*|Error:\s*)?/;
const PROMPT_BOX = /^[\s│┃╭╮╰╯─━>❯›]*$/; // empty input box / separators

// Returns the candidate message lines: the trailing run of non-empty lines before any prompt box.
function trailingBlock(text, maxLines = 6) {
  const lines = String(text ?? '').split(/\r?\n/).map(l => l.replace(/\s+$/, ''));
  let end = lines.length;
  while (end > 0 && (lines[end - 1].trim() === '' || PROMPT_BOX.test(lines[end - 1]))) end--;
  const block = [];
  for (let i = end - 1; i >= 0 && block.length < maxLines; i--) {
    if (lines[i].trim() === '') break;
    block.unshift(lines[i].trim());
  }
  return block;
}

// A message line counts only if it IS the error UI: starts with a recognised marker (or is the bare
// message) and is not quoted, indented code, a comment, a markdown quote or a list/code example.
function isErrorUiLine(line) {
  if (/^(?:>|#|\/\/|\/\*|\*|-\s|\d+[.)]\s|`|"|'|\|)/.test(line)) return false; // quote, comment, list, code fence, string, table
  if (/(?:assert|expect|test\(|it\(|const |let |var |=>|\bclassify|\.md\b)/.test(line)) return false; // code or test text
  return true;
}

// classifyPaneText(text) -> { kind, ... }.  `context.session` / `context.kind` are the recorded
// identity of the member; a pane whose live session/kind differ is NOT the member we started.
export function classifyPaneText(text, context = {}) {
  if (context.expectedSession && context.liveSession !== context.expectedSession) return { kind: 'unknown', reason: 'session-changed' };
  if (context.expectedKind && context.liveKind !== context.expectedKind) return { kind: 'unknown', reason: 'agent-kind-changed' };
  const block = trailingBlock(text);
  if (!block.length) return { kind: 'unknown', reason: 'empty-pane' };
  const lines = block.filter(isErrorUiLine).map(l => l.replace(UI_MARK, ''));
  if (!lines.length) return { kind: 'unknown', reason: 'not-error-ui' };
  const joined = lines.join('\n');
  const explainedNotQuota = /not your usage limit/i.test(joined);
  const quota = QUOTA_PATTERNS.find(p => p.test(joined));
  if (quota && !explainedNotQuota) {
    const reset = joined.match(/resets?\s+([^\r\n·]{1,40})/i);
    return { kind: 'quota-exhausted', matched: joined.match(quota)[0], resetsText: reset ? reset[1].trim() : null };
  }
  const blocked = MODEL_BLOCKED_PATTERNS.find(p => p.test(joined));
  if (blocked) return { kind: 'model-blocked', matched: joined.match(blocked)[0] };
  const budget = BUDGET_PATTERNS.find(p => p.test(joined));
  if (budget && !explainedNotQuota) return { kind: 'budget-blocked', matched: joined.match(budget)[0] };
  for (const [kind, pattern] of NON_QUOTA_PATTERNS) if (pattern.test(joined)) return { kind, reason: 'non-quota-signal' };
  return { kind: 'unknown', reason: 'no-recognised-signal' };
}

// Converts a classification to the observation shape used by models.mjs. budget-blocked is NOT a
// quota observation: it records nothing the threshold rules can act on.
export function observationFromPane(classification, at = new Date().toISOString()) {
  if (classification.kind === 'quota-exhausted') return { at, reliable: true, signal: 'quota-exhausted', source: 'pane-error-ui', matched: classification.matched, resetsText: classification.resetsText };
  if (['rate-limited', 'overloaded', 'auth', 'network', 'context-full'].includes(classification.kind)) {
    const signal = classification.kind === 'overloaded' ? 'rate-limited' : classification.kind;
    return { at, reliable: false, signal, source: 'pane-error-ui' };
  }
  return null; // unknown, budget-blocked or model-blocked: no model-state observation
}
