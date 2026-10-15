// One tested formatter that turns an argv array into a command line for a named shell. Used for
// the commands shown to roles AND for the Bash permission rules, so both always agree. Node itself
// never runs these strings: every real process is started from an argv array with shell:false.
//
// Shells: 'posix' (bash/sh/Git Bash) and 'powershell'. cmd.exe is intentionally unsupported: its
// quoting cannot be made safe for arbitrary text.
const posixSafe = /^[A-Za-z0-9_@%+=:,./-]+$/;

export function quoteArg(shell, value) {
  const text = String(value);
  if (/[\r\n\0]/.test(text)) throw new Error('ARG_HAS_CONTROL_CHARACTER');
  if (shell === 'posix') {
    if (text !== '' && posixSafe.test(text)) return text;
    return `'${text.replace(/'/g, `'\\''`)}'`; // single quotes: nothing inside is special
  }
  if (shell === 'powershell') {
    if (text !== '' && posixSafe.test(text)) return text;
    return `'${text.replace(/'/g, "''")}'`; // single-quoted literal; '' escapes a quote
  }
  throw new Error(`SHELL_UNSUPPORTED: ${shell}`);
}

export function commandLine(shell, argv) {
  const [first, ...rest] = argv.map(a => quoteArg(shell, a));
  // PowerShell needs the call operator when the program path is quoted.
  return shell === 'powershell' && first.startsWith("'") ? `& ${first} ${rest.join(' ')}`.trim() : [first, ...rest].join(' ');
}

// Claude Code on Windows runs its Bash tool through Git Bash, so POSIX quoting is the default.
export const DEFAULT_SHELL = 'posix';
