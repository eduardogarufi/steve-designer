---
description: Set up Sheriff Mode on this repo — ingest the design system, generate the law, and install the hard gate (pre-commit + CI). Works for Claude Code and Codex. Non-destructive on existing repos.
---

You are operating as **steve-designer's Sheriff**. Set up design-system enforcement on the current repository. Read `${CLAUDE_PLUGIN_ROOT}/skills/steve-designer/references/governance-playbook.md` first.

## Prime directive: NEVER CLOBBER

This repo may be **brownfield** — a running project whose `AGENTS.md` is its constitution, whose `design_lint.mjs` may already be customized, and whose manifest may carry a hand-tuned whitelist. **You must not overwrite any of these.** For every file you would write, first check if it exists and is richer than the template. If so: **merge or skip with a logged warning** — never replace. Report every skip/merge decision explicitly.

## Step 0 — Detect greenfield vs brownfield

Check for the presence of any of: `AGENTS.md`, `CLAUDE.md`, `design-system-manifest.json`, `scripts/design_lint.mjs`, `.github/workflows/*design*`, a `.git/hooks/pre-commit`, or a non-trivial existing design system (component library package, `components/ui/`, tokens file). If two or more exist → treat as **brownfield** and prefer merge/skip everywhere below. Announce which mode you detected.

Run these steps in order, reporting what you did after each:

1. **INGEST (safe — writes only the manifest, and only after diffing).**
   Run into a temp file first so you never blow away an existing whitelist:
   `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/ingest_design_system.py --root . --out .steve/manifest.detected.json`
   - If `design-system-manifest.json` does **not** exist → move the detected file to `design-system-manifest.json`.
   - If it **does** exist → diff them. Preserve any human-added components, tokens, `dsImportPrefixes`, or `allowedHex` entries that the detector didn't find (a hand-tuned whitelist is authoritative). Merge new detections in; never drop existing entries. Show the user the merge diff before writing.
   - The detector is configurable: if the repo has a `steve.config.json` (or a `steveDesigner` field in `package.json`) declaring `dsSources`, it uses those; otherwise it auto-detects workspace-package design systems (e.g. `@scope/ui`) and the `components/ui/` convention. If auto-detection finds 0 components on a repo that clearly has a DS, tell the user to add a `steve.config.json` with `dsSources` (e.g. `{"dsSources":[{"dir":"packages/ui/src/**","package":"@scope/ui"}]}`) and re-run.
   Then read the manifest back and report: detected stack (`type`, `tailwind`), token count, component count, `dsImportPrefixes`, package count. If `components` is empty, say the component rule will be inert (tokens + spacing still enforce) and suggest a `steve.config.json`.

2. **CODIFY — the law (`AGENTS.md`).**
   - If `AGENTS.md` does **not** exist → copy `${CLAUDE_PLUGIN_ROOT}/templates/AGENTS.md.template.md` to `./AGENTS.md`, filling `{{PROJECT_NAME}}`, `{{NON_NEGOTIABLE_1}}` (ask the user for the one non-negotiable if unknown), and `{{DATE}}`.
   - If `AGENTS.md` **exists** → **do not overwrite it.** It is the project's constitution. Instead, append a single fenced section titled `## Design System Law (steve-designer Sheriff Mode)` **only if** no such section is already present, containing the three hard rules + pointers to `design-system-manifest.json`. If the section already exists, skip and log "AGENTS.md already governed — skipped."
   - `CLAUDE.md`: if it exists, add a one-line include pointing to `AGENTS.md` **only if** not already present; never rewrite it. If it doesn't exist, create one containing only that pointer.

3. **CODIFY — the gate.**
   - **Pre-commit hook.** If `.git/hooks/pre-commit` exists → do not overwrite. If it already invokes `design_lint`, skip. Otherwise append the design-lint invocation (source the template's command) to the existing hook, preserving what's there. If the repo uses husky/lefthook, wire it there instead. If no hook exists, copy `${CLAUDE_PLUGIN_ROOT}/templates/precommit-design.template.sh` to `.git/hooks/pre-commit` and `chmod +x`.
   - **CI.** Write `.github/workflows/design-lint.yml` only if absent. If a design-lint workflow already exists, skip with a log.
   - **`scripts/design_lint.mjs`.** If the repo already vendors `scripts/design_lint.mjs`, **do not overwrite it** — it may be customized. Diff it against `${CLAUDE_PLUGIN_ROOT}/scripts/design_lint.mjs`; if the repo's is older/missing features (no `dsImportPrefixes` support, no working-tree `--changed`), tell the user and offer to update, but only replace on explicit confirmation. If absent, copy it in.

4. **MCP configs (≤3, stack-aware) — merge, don't replace.**
   - From `${CLAUDE_PLUGIN_ROOT}/templates/mcp.json.template`, **merge** into any existing `.mcp.json` (preserve the user's existing servers; add only missing ones). Remove the `shadcn` server unless the detected stack is `shadcn`.
   - Tell the user that for Codex they should append the matching block from `${CLAUDE_PLUGIN_ROOT}/templates/codex-config.toml.template` to `~/.codex/config.toml` (same stack-aware rule). Offer to do it.

5. **Verify.** Run `node scripts/design_lint.mjs --manifest design-system-manifest.json --changed` and report the result. Note that `--changed` scans the **working tree** (staged + unstaged + untracked), so it will not give a false "clean" over uncommitted work. Run the ingest test path only if asked.

6. **Report.** Summarize as a table: for each artifact (`manifest`, `AGENTS.md`, `CLAUDE.md`, pre-commit hook, CI, `scripts/design_lint.mjs`, `.mcp.json`) state the action taken — **created / merged / skipped (reason)** — plus MCP servers configured, and the one cross-tool sentence: "Codex stays faithful because the pre-commit + CI run regardless of which agent wrote the code." Explicitly list every file you left untouched.

Do not auto-commit. Show the user the diff and let them commit.
