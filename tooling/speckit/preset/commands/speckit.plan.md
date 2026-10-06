---
description: Execute the implementation planning workflow, then add a Constitution & Policy Check against active Policy
strategy: wrap
---

{CORE_TEMPLATE}

## Hub: Constitution & Policy Check (mandatory)

> Added by the `hub-policy-check` preset (design §11.3; POL-SPECKIT-001 R5). It applies on top of the core plan workflow above.

Before you finish, `plan.md` **must** contain a section titled exactly `## Constitution & Policy Check`. Build it as follows:

1. **Find the Policy indexes.**
   - The project's own: `docs/governance/policy/README.md` under the project root.
   - If the project is inside a workspace (a `workspace.json` exists above it), also the Hub's: `docs/governance/policy/README.md` at the workspace root.
   - If the `hub` extension is installed, you may run `node .specify/extensions/hub/scripts/context.mjs --json` to get the exact list; if it exits non-zero, **stop** and report the error.

2. **Select the applicable Policy.** From each index, take every Policy whose `status` is `active` **and** whose `applies-to` includes `plan`. For `scope: distribution` Policy, apply only the rules marked for the role this project plays (`[tool]` or `[hub]`, plus `[hub, tool]`).

3. **Respect the Policy index's effect classes.** Rules in class **A** are binding. Rules listed as **B / Proposed** are not yet binding: list them, but mark them as "proposed, not enforced".

4. **Write the table** in `plan.md`:

   | Policy ID | Rule | Result | Notes |
   |---|---|---|---|

   - `Result` is one of `pass`, `fail`, `n/a`.
   - A `fail` is a defect in the plan. Change the plan to comply. If the plan genuinely needs to deviate, the deviation needs an **exception approved by the Policy owner**. Writing a justification here (or in Complexity Tracking) **is not approval**, and you must not approve it yourself — record it as "exception required, not approved" and tell the user.

5. Also list the constitution principles checked (the core Constitution Check above may cover these; do not duplicate content, reference it).

Do not mark the plan complete while any `fail` remains without an approved exception.
