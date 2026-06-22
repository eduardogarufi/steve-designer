---
description: Set up Sheriff Mode on this repo — ingest the design system, generate the law, and install the hard gate (pre-commit + CI). Works for Claude Code and Codex.
---

You are operating as **steve-designer's Sheriff**. Set up design-system enforcement on the current repository. Read `${CLAUDE_PLUGIN_ROOT}/skills/steve-designer/references/governance-playbook.md` first.

Run these steps in order, reporting what you did after each:

1. **INGEST.** Run:
   `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/ingest_design_system.py --root . --out design-system-manifest.json`
   Then read the manifest back and tell the user: detected stack, token count, component count, package count. If the stack is `tailwind-css` (no component whitelist), say so — the component rule will be inert, tokens + spacing still enforce.

2. **CODIFY — the law.** Copy `${CLAUDE_PLUGIN_ROOT}/templates/AGENTS.md.template.md` to `./AGENTS.md`, filling `{{PROJECT_NAME}}`, `{{NON_NEGOTIABLE_1}}` (ask the user for the one non-negotiable if unknown), and `{{DATE}}`. If a `CLAUDE.md` exists, add a one-line include pointing to `AGENTS.md`; if not, create a `CLAUDE.md` containing only that pointer.

3. **CODIFY — the gate.**
   - Install the pre-commit hook: copy `${CLAUDE_PLUGIN_ROOT}/templates/precommit-design.template.sh` to `.git/hooks/pre-commit` (or, if the repo uses husky/lefthook, wire it there instead) and `chmod +x` it.
   - Install CI: copy `${CLAUDE_PLUGIN_ROOT}/templates/ci-design-check.template.yml` to `.github/workflows/design-lint.yml`.
   - Copy `${CLAUDE_PLUGIN_ROOT}/scripts/design_lint.mjs` into the repo at `scripts/design_lint.mjs` (the hook + CI reference a repo-local path). If the repo already vendors it, skip.

4. **MCP configs (≤3, stack-aware).**
   - From `${CLAUDE_PLUGIN_ROOT}/templates/mcp.json.template`, write/merge `.mcp.json`. Remove the `shadcn` server unless the detected stack is `shadcn`.
   - Tell the user that for Codex they should append the matching block from `${CLAUDE_PLUGIN_ROOT}/templates/codex-config.toml.template` to `~/.codex/config.toml` (same stack-aware rule). Offer to do it.

5. **Verify.** Run `node scripts/design_lint.mjs --manifest design-system-manifest.json --changed` and report the result. Run the ingest test path only if asked.

6. **Report.** Summarize: manifest path, AGENTS.md path, hook installed (y/n), CI installed (y/n), MCP servers configured, and the one cross-tool sentence: "Codex stays faithful because the pre-commit + CI run regardless of which agent wrote the code."

Do not auto-commit. Show the user the diff and let them commit.
