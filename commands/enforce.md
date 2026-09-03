---
description: Set up governance on this repo — ingest the design system, generate `docs/design/`, write the law, and install the hard gate (pre-commit + CI). Works for Claude Code and Codex. Non-destructive on existing repos.
---

You are operating as **steve-designer in Governance mode**. Set up design-system ownership and enforcement on the current repository. Read `${CLAUDE_PLUGIN_ROOT}/skills/steve-designer/references/governance-playbook.md` first.

## Prime directive: NEVER CLOBBER

This repo may be **brownfield** — a running project whose `AGENTS.md` is its constitution, whose `design_lint.mjs` may already be customized, and whose manifest may carry a hand-tuned whitelist. **You must not overwrite any of these.** For every file you would write, first check if it exists and is richer than the template. If so: **merge or skip with a logged warning** — never replace. Report every skip/merge decision explicitly.

## Step 0 — Detect greenfield vs brownfield

Check for the presence of any of: `AGENTS.md`, `CLAUDE.md`, `docs/design/` (any file in it), `docs/design/manifest.json`, `design-system-manifest.json`, `scripts/design_lint.mjs`, `.github/workflows/*design*`, a `.git/hooks/pre-commit`, or a non-trivial existing design system (component library package, `components/ui/`, tokens file). If two or more exist → treat as **brownfield** and prefer merge/skip everywhere below. Announce which mode you detected.

## Path resolution (applies to every step)

The manifest and the brief resolve in one fixed order, and you never choose in silence:

1. an explicit flag, if the user passed one;
2. `docs/design/manifest.json` (resp. `docs/design/brief.md`) if it exists;
3. the legacy root path `design-system-manifest.json` (resp. `design-brief.md`) if it exists;
4. otherwise `docs/design/manifest.json` (resp. `docs/design/brief.md`) as the **creation** target.

If **both** the new and the legacy path exist, **stop** and report the diagnostic naming both files. Do not pick one.

**The override policy, everywhere in this repo:** explicit `--manifest` wins; otherwise `docs/design/manifest.json`, then legacy root; both present = stop and run `enforce` to migrate.

## Step 1 — Atomic migration (before ingest)

Before running INGEST, resolve the legacy-vs-new state for both the manifest and the brief:

- If `design-system-manifest.json` exists at the root and `docs/design/manifest.json` does **not** → `git mv design-system-manifest.json docs/design/manifest.json` (creating `docs/design/` if needed) and show the user the move. Do the same for `design-brief.md` → `docs/design/brief.md`.
- If **both** the legacy and the new path exist for either file → **stop** and ask the user to choose, showing a diff between the two files. Never proceed with both present.
- If only the new path exists, or neither exists yet, there is nothing to migrate — continue.

Run the remaining steps in order, reporting what you did after each:

1. **INGEST (safe — writes only the manifest, and only after diffing).**
   Run into a temp file first so you never blow away an existing whitelist:
   `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/ingest_design_system.py --root . --manifest .steve/manifest.detected.json`
   - Resolve the destination with the order above. If no manifest exists yet → create `docs/design/` and move the detected file to `docs/design/manifest.json`.
   - If one **does** exist → diff them. Preserve any human-added components, tokens, `dsImportPrefixes`, or `allowedHex` entries that the detector didn't find (a hand-tuned whitelist is authoritative). Merge new detections in; never drop existing entries. Show the user the merge diff before writing.
   - The detector is configurable: if the repo has a `steve.config.json` (or a `steveDesigner` field in `package.json`) declaring `dsSources`, it uses those; otherwise it auto-detects workspace-package design systems (e.g. `@scope/ui`) and the `components/ui/` convention. If auto-detection finds 0 components on a repo that clearly has a DS, tell the user to add a `steve.config.json` with `dsSources` (e.g. `{"dsSources":[{"dir":"packages/ui/src/**","package":"@scope/ui"}]}`) and re-run.
   Then read the manifest back and report: detected stack (`type`, `tailwind`), token count, component count, `dsImportPrefixes`, package count. If `components` is empty, say the component rule will be inert (tokens + spacing still enforce) and suggest a `steve.config.json`.

2. **The design doc — `docs/design/`.**
   - **`docs/design/design-doc.md`.** Generate it from `${CLAUDE_PLUGIN_ROOT}/skills/steve-designer/templates/design-doc.template.md`, filled from the manifest and, when present, the brief. Tokens, components, states and paths come from the manifest — do not invent values.
     If it **already exists**, merge: fold new tokens and components into the tables, and **never overwrite §1 (principles), §3 (voice & microcopy), §9 (reference design system) or §10 (the "locked" checklist)** — those are human judgement, not detection output.
   - **`docs/design/contrast.md`.** Spawn `tokens-engineer` (`${CLAUDE_PLUGIN_ROOT}/agents/tokens-engineer.md`) in **audit mode**: pass it the resolved manifest and tell it to produce only `docs/design/contrast.md` — the fg×bg matrix against WCAG 2.1 plus the forbidden-pairs list. It generates no new tokens in this mode.
   - **`docs/design/screens.md`** and **`docs/design/decisions.md`.** Seed them from `${CLAUDE_PLUGIN_ROOT}/skills/steve-designer/templates/screens.template.md` and `decisions.template.md` **only if absent**. Never overwrite either — they are history.

3. **CODIFY — the law (`AGENTS.md`).**
   - If `AGENTS.md` does **not** exist → copy `${CLAUDE_PLUGIN_ROOT}/templates/AGENTS.md.template.md` to `./AGENTS.md`, filling `{{PROJECT_NAME}}`, `{{NON_NEGOTIABLE_1}}` (ask the user for the one non-negotiable if unknown), and `{{DATE}}`.
   - If `AGENTS.md` **exists** → **do not overwrite it.** It is the project's constitution. Instead, append a single fenced section titled `## Design System Law (steve-designer)` **only if** no such section is already present, containing the hard rules plus pointers to `docs/design/` (the canonical docs), to the resolved manifest, and to `docs/design/capabilities.md` (what Steve does and how any agent invokes him — the copy this step generates). If the section already exists, skip and log "AGENTS.md already governed — skipped."
   - `CLAUDE.md`: if it exists, add a one-line include pointing to `AGENTS.md` **only if** not already present; never rewrite it. If it doesn't exist, create one containing only that pointer.
   - **`docs/design/capabilities.md`.** Copy `${CLAUDE_PLUGIN_ROOT}/skills/steve-designer/references/capabilities.md` to `docs/design/capabilities.md` so any agent inside this project can read it without the plugin. If it already exists, overwrite it only when it is byte-identical to the previous template (a stale, unmodified copy), or with explicit user confirmation otherwise — never clobber a hand-edited copy silently.

4. **CODIFY — the gate.**
   - **Pre-commit hook.** If `.git/hooks/pre-commit` exists → do not overwrite. If it already invokes `design_lint`, skip. Otherwise append the design-lint invocation (source the template's command) to the existing hook, preserving what's there. If the repo uses husky/lefthook, wire it there instead. If no hook exists, copy `${CLAUDE_PLUGIN_ROOT}/templates/precommit-design.template.sh` to `.git/hooks/pre-commit` and `chmod +x`. The templates no longer pass `--manifest` — the linter resolves the path itself.
   - **CI.** Write `.github/workflows/design-lint.yml` only if absent. If a design-lint workflow already exists, skip with a log.
   - **`scripts/design_lint.mjs`.** If the repo already vendors `scripts/design_lint.mjs`, **do not overwrite it** — it may be customized. Run `node scripts/design_lint.mjs --version`; if it fails or reports below `0.3.0` (missing `--emit-scope`, `--version`, or fail-closed flag parsing), tell the user their vendored linter is out of date and that `/steve-designer:check` will not work correctly against it — **offer to replace it**, showing the diff against `${CLAUDE_PLUGIN_ROOT}/scripts/design_lint.mjs`, and only replace on explicit confirmation. If absent, copy it in.

5. **MCP configs (≤3, stack-aware) — merge, don't replace.**
   - From `${CLAUDE_PLUGIN_ROOT}/templates/mcp.json.template`, **merge** into any existing `.mcp.json` (preserve the user's existing servers; add only missing ones). Remove the `shadcn` server unless the detected stack is `shadcn`.
   - Tell the user that for Codex they should append the matching block from `${CLAUDE_PLUGIN_ROOT}/templates/codex-config.toml.template` to `~/.codex/config.toml` (same stack-aware rule). Offer to do it.

6. **Verify.** Run `node scripts/design_lint.mjs --changed` and report the result. Note that `--changed` scans the **working tree** (staged + unstaged + untracked), so it will not give a false "clean" over uncommitted work. Exit `2` is a configuration or scope failure — report it as a failure, never as clean. Run the ingest test path only if asked.

7. **Report.** Summarize as a table: for each artifact (`manifest`, `docs/design/design-doc.md`, `docs/design/contrast.md`, `docs/design/screens.md`, `docs/design/decisions.md`, `docs/design/capabilities.md`, `AGENTS.md`, `CLAUDE.md`, pre-commit hook, CI, `scripts/design_lint.mjs`, `.mcp.json`) state the action taken — **created / merged / skipped (reason)** — plus MCP servers configured, any Step 1 migrations performed (`design-system-manifest.json` → `docs/design/manifest.json`, `design-brief.md` → `docs/design/brief.md`), and the one cross-tool sentence: "Codex stays faithful because the pre-commit + CI run regardless of which agent wrote the code." Explicitly list every file you left untouched. Close by naming the next command: `/steve-designer:build` or `/steve-designer:handoff` for a UI change, `/steve-designer:check` before committing.

Do not auto-commit. Show the user the diff and let them commit.
