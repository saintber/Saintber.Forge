---
description: "Resolve the target project and load constitution, Policy index and effective-spec index"
---

# Hub context

Load the shared context for this Spec Kit session (POL-SPECKIT-001 R2–R4).

## User input

```text
$ARGUMENTS
```

If the user named a project (an id from `workspace.json`, or a directory), pass it as `--project <value>`. Otherwise pass nothing.

## Steps

1. Locate the script. It is in this extension's directory:
   `.specify/extensions/hub/scripts/context.mjs`
   If that path does not exist, search upward from the current directory for `.specify/extensions/hub/scripts/context.mjs`. If you still cannot find it, **stop and report** that the hub extension is not installed. Do not improvise its behaviour.

2. Run it with Node, from the current directory:

   ```text
   node <path-to>/context.mjs --json [--project <value>]
   ```

3. **If the exit code is not 0, stop.** Report the `error` and `message` fields verbatim. Do **not** fall back to another project, to the Hub root, or to "standalone". Do **not** create any file. This is a hard rule: an invalid target must produce an error and nothing else.

4. On success, report to the user, in this order:
   - target project id, project root, mode (`workspace` or `standalone`), and how it was resolved;
   - the output location (`outputRoot`) — any new work package goes there and **nowhere else**;
   - the suggested next change number (`nextChange`);
   - the list in `read`.

5. Read every file listed in `read` before doing further work in this session. Treat Policy whose `status` is `active` as binding, according to the classes described in the Policy index.

Do not modify any file in this command.
