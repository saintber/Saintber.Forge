---
name: speckit-hub-archive
description: Archive a work package (adopted, cancelled or superseded); retry-safe, never overwrites
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: saintber
  source: hub:commands/speckit.hub.archive.md
---

# Hub archive

Archive a work package and its inputs (POL-SPEC-001 R6, R7).

## User input

```text
$ARGUMENTS
```

The input must name the work package, and may give a status: `adopted` (default), `cancelled` or `superseded`. If the package is missing, ask and stop.

- `adopted` requires that the change was already adopted.
- `cancelled` and `superseded` are archived **without** adopting; the effective spec is not touched.

## Steps

1. Locate `.specify/extensions/hub/scripts/archive.mjs` (search upward if needed). If missing, **stop** and report that the hub extension is not installed.

2. Run:

   ```text
   node <path-to>/archive.mjs --change <NNN-name> --status <status> --json [--project <id>]
   ```

3. **If the exit code is not 0, stop and report `error` and `message` verbatim.** In particular:
   - `TARGET_DIFFERS` — an archive already exists with different content. **Never** overwrite or delete it.
   - `NOT_ADOPTED` — adopt first, or archive with `cancelled` / `superseded` if that is the truth.
   - `APPLY_FAILED` — the script removed only the archive it had created; the original work package is untouched.

4. On success, report `archivedTo`. If `alreadyArchived` is true, say so: the run was a safe retry.

5. **Do not run `git add`, `git commit`, `git stash`, `git reset` or `git checkout`.** Leave the changes for the user's normal review.