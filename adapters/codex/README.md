# steve-designer — Codex adapter

This bundle makes Steve Designer's skill, subagents, and in-session lint hook
available in the **Codex** CLI. The design-system **law** does not depend on this
bundle: a governed project is enforced by `AGENTS.md`, `docs/design/manifest.json`,
`scripts/design_lint.mjs`, the pre-commit hook, and CI — Codex honours the same
git-level gate as any other executor.

## Install

```bash
./install.sh --cli codex --global     # ~/.agents/skills + ~/.codex
./install.sh --cli codex --project    # ./.agents/skills + ./.codex
```

`python3` is required: the installer uses it to merge configuration safely and to
rewrite the skill path. The installer fails early with a clear message if it is
missing, rather than leaving a half-configured install.

## Layout

```
.agents/skills/steve-designer/    SKILL.md + references/ + templates/ + scripts/ + commands/
.codex/agents/steve_*.toml        subagents (name / description / developer_instructions)
.codex/mcp.toml                   MCP servers — merged into config.toml
.codex/hooks.json                 PostToolUse lint hook — merged into hooks.json
```

Every installed file records the absolute path of the skill directory, so the
skill's scripts run correctly no matter which directory Codex was started in.

## Invocation

Codex has no slash-command namespacing for skills. Invoke the skill directly:

```
$steve-designer enforce
$steve-designer check --pr 42
$steve-designer build "pricing section"
```

The eight workflows are `start`, `resume`, `enforce`, `check`, `build`, `handoff`,
`arsenal`, `help`. Each is defined in the installed skill at
`<skill>/commands/<name>.md`, and the skill's `SKILL.md` routes you there.

No custom prompts are shipped. Codex custom prompts are user-level and deprecated
in favour of skills; keeping a stale `.codex/prompts/` copy would document an
invocation that is not the supported one.

## Subagents

| Codex agent | Sandbox | Role |
|---|---|---|
| `steve_tokens_engineer` | workspace-write | Token system + preview + contrast matrix |
| `steve_component_builder` | workspace-write | Builds/conforms one screen at a time |
| `steve_design_critic` | read-only | Senior-designer visual critique |
| `steve_design_enforcer` | read-only | Semantic review against the manifest |

**Known difference:** the two reviewers run `read-only`, so they cannot create the
`.steve/` directory or write their `OUTPUT_FILE` report. They return the full
report in their final message, and the orchestrating workflow persists it. The
report contract is otherwise unchanged.

## Hook

`hooks.json` registers a `PostToolUse` handler matching `apply_patch|Edit|Write`.
The handler runs the portable wrapper `hook_design_lint.sh`, which is silent on an
ungoverned project and, on a violation, writes the findings to stderr and exits 2
— the feedback path Codex documents for `PostToolUse`.

Two things to know:

- **Non-managed hooks must be reviewed and trusted.** Run `/hooks` in Codex to
  inspect and trust the handler; until then Codex skips it.
- **Project-local hooks load only when the project `.codex/` layer is trusted.**
  An untrusted project still gets user-level hooks.

If the hook never fires, check trust first. The git-level gate is unaffected
either way — the hook is convenience, not the guarantee.

## What differs from Claude Code

- **No `hooks.json` lifecycle parity.** Codex hooks are the events Codex exposes;
  this adapter uses `PostToolUse`, not a Claude-style `PostToolUse` matcher set.
- **Arsenal degrades.** `frontend-design` and `ui-ux-pro-max-skill` are Claude Code
  plugins. Creation mode reports them as unavailable and runs in degraded mode.
  Governance and Direction do not degrade.
