# steve-designer — Kilo adapter

This bundle makes Steve Designer's commands, skill, and subagents available in the
**Kilo** CLI. The design-system **law** does not depend on this bundle: a governed
project is enforced by `AGENTS.md`, `docs/design/manifest.json`,
`scripts/design_lint.mjs`, the pre-commit hook, and CI — all of which Kilo honours
through the same git-level gate as any other executor.

## Install

```bash
./install.sh --cli kilo --global     # ~/.config/kilo
./install.sh --cli kilo --project    # ./.kilo
```

`python3` is required: the installer uses it to merge `kilo.json` safely and to
rewrite the skill path. It fails early with a clear message if it is missing.

## Layout

```
.kilo/                        (or ~/.config/kilo/)
├── skills/steve-designer/    SKILL.md + references/ + templates/ + scripts/ + commands/
├── command/steve-*.md        thin dispatchers into the skill
└── agent/steve-*.md          subagents (mode: subagent)
kilo.json                     MCP servers, merged key-aware into your config
```

The command files are deliberately thin: each one tells the agent to load the
`steve-designer` skill and execute the named workflow from
`<skill>/commands/<name>.md`, resolving relative paths against the skill rather
than the project. Every installed file carries the absolute skill path, so this
works regardless of the directory Kilo was started in.

## Commands

| Kilo command | Steve mode |
|---|---|
| `/steve-start` | Creation — the six phases from zero |
| `/steve-resume` | Creation — resume from the brief |
| `/steve-enforce` | Governance — adopt and govern an existing design system |
| `/steve-check` | Governance — verify a change (working tree, commit, range, PR) |
| `/steve-build` | Direction — build or conform one screen |
| `/steve-handoff` | Direction — the same contract, as a prompt for any executor |
| `/steve-arsenal` | Transversal — check the toolchain |
| `/steve-help` | Transversal — print the capability map |

Kilo has no command namespacing, so each command maps to a flat `/steve-<cmd>`
name. The deprecated `guard`/`patrol` aliases are not re-created.

The skill is also discoverable by name: ask Kilo to "use the steve-designer skill"
and it will route to the right mode from `SKILL.md`.

## MCP

The installer merges the `mcp` block into your project `kilo.json` or your global
`~/.config/kilo/kilo.json`. The merge is key-aware: a server you already define is
left untouched, never duplicated. The result is validated as JSON before the file
is replaced. Add the `shadcn` server only when the repository actually uses shadcn.

## What differs from Claude Code

- **No in-session hook.** Kilo has no `hooks.json`; replicating the PostToolUse lint
  would require a Kilo plugin in TypeScript. By decision, Kilo relies on the
  git-level gate (pre-commit + CI) plus `/steve-check`. The guarantee is unchanged;
  only the immediacy of the in-session warning differs.
- **Arsenal degrades.** `frontend-design` and `ui-ux-pro-max-skill` are Claude Code
  plugins. Creation mode reports them as unavailable and runs in degraded mode
  (Steve still conducts discovery, references, tokens, and the contract).
  Governance and Direction do not degrade.
