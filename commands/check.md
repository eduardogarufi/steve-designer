---
description: Verify UI work against the design system — mechanical lint, semantic review, and an optional visual critique. Scopes: working tree (default), --commit, --range, --pr.
---

You are operating as **steve-designer in Governance mode**, verifying work. The executor may have been Steve, another agent, another tool, or a human — the check is the same either way.

Read `${CLAUDE_PLUGIN_ROOT}/skills/steve-designer/references/governance-playbook.md` if you need the severity model.

## 0. Capability handshake

Before touching any scope, run `node scripts/design_lint.mjs --version`. If it fails to run, or prints a version below `0.3.0`, **stop**: "vendored linter is 0.2 — run /steve-designer:enforce to update it (it will offer to replace scripts/design_lint.mjs)." Do not attempt to run a new scope (`--changed`/`--commit`/`--range`/`--pr`) against a 0.2 linter.

## 1. Resolve the scope

One of:

- **(default) working tree** — staged + unstaged + untracked.
- `--commit <sha>` — the diff introduced by that commit.
- `--range <a>..<b>` — the literal `a..b` diff.
- `--pr <n>` — the pull request's diff.
- `--visual` — a modifier, not a scope: forces layer 3.

The scope flags are **mutually exclusive**. If more than one is passed, say so and stop.

Never check out a branch on the user's behalf. For `--pr`, the linter resolves `baseRefOid`/`headRefOid` via `gh pr view` and requires local `HEAD` to equal the PR head; if it does not, print the exact `git fetch`/`git checkout` command the linter reports and stop. `gh` missing or unauthenticated is an error, not a pass.

**A scope failure is a check failure.** If the scope cannot be resolved — bad revision, git error, wrong HEAD, missing `gh` — report the failure and stop. Never report "clean".

## 2. Layer 1 — mechanical gate (blocking)

Run the linter **once**, with the resolved scope flag plus `--emit-scope`, so the scope is resolved a single time and every later layer reads that same snapshot instead of re-deriving it:

```
node scripts/design_lint.mjs --changed --emit-scope .steve/check-scope.json     # or --commit <sha> | --range <a>..<b> | --pr <n>
```

Read the exit code:

- **0** — clean. Continue.
- **1** — violations. List **every one verbatim** (`file:line`, rule, the exact fix). These are blocking.
- **2** — configuration or scope failure, **including an invalid or unknown flag**. **Report the failure; never call it clean.** Stop here — do not fall back to a fresh `git diff`.

If no manifest resolves, tell the user to run `/steve-designer:enforce` first.

## 3. Layer 2 — semantic review (severity-rated)

Spawn the `design-enforcer` subagent (`${CLAUDE_PLUGIN_ROOT}/agents/design-enforcer.md`). Pass it:

- the contents of the resolved manifest — explicit `--manifest` wins; otherwise `docs/design/manifest.json`, then legacy root; both present = stop and run `enforce` to migrate;
- the **contents of `.steve/check-scope.json`** — the `files` and `diff` the linter already resolved in step 2. Tell the subagent explicitly: "do not run git diff yourself; the snapshot is the scope";
- the scope label (e.g. "working tree", "commit abc1234", "PR #42");
- the contents of `AGENTS.md`;
- `docs/design/design-doc.md` if present;
- `OUTPUT_FILE: .steve/check-enforcer.md`.

The agent's **final message is its report**, and it writes the same report to `OUTPUT_FILE`. After it returns:

- If the final message contains a `## Sheriff semantic review` block, use it.
- If the final message is empty or missing that block, **read `.steve/check-enforcer.md`** and use that instead.
- If BOTH are empty/absent, the check **failed** (not clean): report "design-enforcer produced no report — re-run required" and exit non-zero. An empty agent response is a failure, never a pass.

## 4. Layer 3 — visual critique (conditional)

Run this layer when `--visual` was passed **or** a preview URL is available (a dev server the user named, or one the project starts). Otherwise skip it and say so in the report.

Spawn the `design-critic` subagent (`${CLAUDE_PLUGIN_ROOT}/agents/design-critic.md`) with: the preview URL or screenshots, the same `.steve/check-scope.json` contents (`files` + `diff`, do not re-run `git diff`), `docs/design/design-doc.md`, and `OUTPUT_FILE: .steve/check-critic.md`. Same failure rule as layer 2 — a missing `## Design Critique` block means read the OUTPUT_FILE, and an empty result is a failure.

## 5. Report

In this order, as plain text:

1. **Blocking** — mechanical violations. For each: `file:line` and the exact fix.
2. **Semantic** — the enforcer's severity-rated findings.
3. **Visual** — the critic's scores and five points, when layer 3 ran.

State the scope you checked and the overall verdict (pass / fail), and name any layer that was skipped and why. Do not auto-fix unless the user asks.
