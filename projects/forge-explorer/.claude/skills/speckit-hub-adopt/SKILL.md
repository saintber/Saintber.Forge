---
name: speckit-hub-adopt
description: Merge a verified work package into the effective specification (baseline-checked, no auto-commit)
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: saintber
  source: hub:commands/speckit.hub.adopt.md
---

# Hub adopt

Merge a **verified** work package into the effective specification (POL-SPEC-001 R5, R7, R9).

## User input

```text
$ARGUMENTS
```

The input must name the work package, e.g. `002-selective-install`. If it does not, ask for it and stop.

## Steps

1. Locate `.specify/extensions/hub/scripts/adopt.mjs` (search upward from the current directory if needed). If missing, **stop** and report that the hub extension is not installed.

2. Run:

   ```text
   node <path-to>/adopt.mjs --change <NNN-name> --json [--project <id>]
   ```

3. **If the exit code is not 0, stop and report `error`, `message` and `details` verbatim.** In particular:
   - `NOT_VERIFIED` — `verification.md` does not end in `Final Status: Done`. Do not edit it to make it pass.
   - `BASELINE_CONFLICT` — the target spec changed since the baseline (another adopt, staged or uncommitted edits). Tell the user to re-compare the Delta against the current effective spec. **Never** overwrite, reset, stash or discard those changes.
   - `REQ_INVALID` — requirement ID problems; list them.
   - `TMP_EXISTS` — a previous run left `.specify/tmp/<change>`; ask the user to inspect it.
   - `APPLY_FAILED` — the script already restored only the files it touched; report which.

   Do **not** try to achieve the same result by editing the effective spec by hand.

4. On success, report the files written.

5. **Do not run `git add`, `git commit`, `git stash`, `git reset` or `git checkout`.** The changes stay in the working tree for the user's normal review. Suggest the next step: `archive`.