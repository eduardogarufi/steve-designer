# steve-designer

**The owner of a project's UI design system — in Claude Code, Kilo, and Codex.**

In any project that invokes it, steve-designer creates the design system from scratch or
adopts an existing one; it directs every subsequent UI change — building it directly
through subagents, or handing a contract to another executor; it verifies any executor's
work — working tree, a commit, a range, or a PR — mechanically, semantically, and
visually; and it maintains the canonical documentation for the system in `docs/design/`.

The enforcement is **portable**: it lives in git-level artifacts (`AGENTS.md`,
`docs/design/**`, `scripts/design_lint.mjs`, the pre-commit hook, and CI), so it holds no
matter which agent — or human — wrote the code. The skill, commands, subagents, and hooks
are the per-CLI convenience layer on top of that.

## Three modes

### Creation

Builds a design system and the UI on it from zero: arsenal check → discovery →
references → tokens → build → polish. Conducts the strategic conversation that prevents
AI-generic output, synthesizes references from Awwwards (for web) and Mobbin (for apps),
defines your design tokens, then hands execution to `frontend-design`,
`ui-ux-pro-max-skill`, Playwright, and the polish pipeline.

- `/steve-designer:start` — begin a new session
- `/steve-designer:resume` — continue an existing session from `docs/design/brief.md`

### Governance

Adopts an existing codebase's design system and enforces it going forward.

- `/steve-designer:enforce` — one-time-per-repo setup: ingests the existing design
  system, writes `docs/design/manifest.json` + `docs/design/design-doc.md` +
  `AGENTS.md`, and installs the hard gate (pre-commit + CI). Never clobbers a brownfield
  repo — merges or skips with a logged decision.
- `/steve-designer:check` — verifies a UI change against the governed system: mechanical
  lint (blocks) → `design-enforcer` semantic review → an optional `design-critic` visual
  pass. Scopes: working tree (default), `--commit <sha>`, `--range <a>..<b>`, `--pr <n>`.

### Direction

Drives a specific UI change on an already-governed project.

- `/steve-designer:build` — Steve reads the manifest and design doc, assembles the
  screen contract, and builds (or conforms) the screen via `component-builder`. Ends by
  running `check`.
- `/steve-designer:handoff` — the same contract as `build`, delivered as a prompt for
  another executor (Claude, Codex, v0, Lovable, a human) instead of built by Steve.

### Transversal

- `/steve-designer:arsenal` — checks that the plugin's own toolchain (frontend-design,
  ui-ux-pro-max, Context7, Playwright) is present and reports what's missing.
- `/steve-designer:help` — prints the canonical capability map
  (`skills/steve-designer/references/capabilities.md`) verbatim, for a human or another
  agent.

**Deprecated aliases removed in 0.4.0:** `/steve-designer:guard` → `enforce`,
`/steve-designer:patrol` → `check`.

## How another agent uses Steve

An agent that has never heard of the steve-designer plugin still operates under Steve's
law on a governed project:

1. **Read `AGENTS.md`** at the project root. It states the rule plainly and points to
   `docs/design/` and to `docs/design/capabilities.md`.
2. **Ask for a `handoff` contract before writing UI.** Don't invent a screen's tokens,
   components, or copy — request the contract, or read one already produced under
   `docs/design/handoffs/`.
3. **Run `node scripts/design_lint.mjs --changed` before committing.** The pre-commit
   hook and the CI gate run this regardless of which agent or tool wrote the code — it is
   not bypassed by not using the plugin.
4. **Run `check` after.** `check` verifies working tree, a commit, a range, or a PR — the
   same way whether Steve, another agent, or a human wrote the change.

## `docs/design/` — the canonical documentation

```
docs/design/
├── design-doc.md       # the canonical source: principles, tokens, voice, components,
│                        # required states, screens pointer, accessibility, zero-hardcode
│                        # rules, reference DS, "cravado" checklist, history
├── brief.md             # memory of the Creation phases (discovery, references, voice)
├── manifest.json         # machine inventory: tokens, components + props + states + a11y,
│                        # i18n config, voice config (schemaVersion 2)
├── contrast.md           # fg×bg contrast matrix (WCAG 2.1) + forbidden-pairs list
├── screens.md            # screen → route → components → required states → origin
├── decisions.md          # version · date · author · change · lesson, + halt-and-ask queue
├── capabilities.md       # copy of the capability map, so any agent can read Steve cold
└── handoffs/              # one file per contract delivered to an external executor
```

Legacy paths (`design-brief.md`, `design-system-manifest.json` at the project root) are
still resolved as a fallback. If both a legacy and a `docs/design/` path exist, every
command stops and names both files rather than guessing.

**The override policy:** explicit `--manifest` wins; otherwise `docs/design/manifest.json`,
then legacy root; both present = stop and run `enforce` to migrate.

## Example prompts

```
/steve-designer:start
```
```
/steve-designer:enforce
```
```
Steve, I need a screen for [X] with [sections/fields]. Use this project's design
system — read the manifest and use only the components and tokens that already exist.
Don't invent anything new.
```
```
Steve, review [path/to/screen.tsx] and bring it in line with the design system: swap
hardcoded values for tokens, use the correct inventory components instead of generic
ones, and fix spacing to the scale. Show me the diff before applying it.
```

## Install

### Claude Code

Install it with the built-in plugin CLI.

```bash
# From the CapitalTrend marketplace
claude plugin marketplace add CapitalTrendGroup/claude-marketplace
claude plugin install steve-designer@capitaltrendgroup-internal

# …or from GitHub
claude plugin marketplace add eduardogarufi/steve-designer
claude plugin install steve-designer@steve-designer
```

Then restart Claude Code.

### Kilo and Codex

Kilo and Codex are file-based: the installer renders a bundle from the single source and
copies it into the CLI's config directory. `python3` is required — the installer uses it to
merge configuration safely (never duplicating a server you already define) and to anchor
each file to the absolute skill path.

```bash
git clone https://github.com/eduardogarufi/steve-designer.git
cd steve-designer

./install.sh --cli kilo  --global     # ~/.config/kilo
./install.sh --cli codex --global     # ~/.agents/skills + ~/.codex
./install.sh --cli kilo  --project    # into ./.kilo
./install.sh --cli codex --project    # into ./.agents + ./.codex
./install.sh --cli all   --global     # every CLI found on PATH
```

| CLI | Command entry point | Subagents | In-session hook |
|---|---|---|---|
| Claude Code | `/steve-designer:enforce` | `agents/*.md` | PostToolUse |
| Kilo | `/steve-enforce` | `agent/steve-*.md` | — (git gate only) |
| Codex | `$steve-designer enforce` | `.codex/agents/steve_*.toml` | `PostToolUse` on `apply_patch` |

The Kilo and Codex command files are thin dispatchers: they load the installed skill and
run the named workflow from `<skill>/commands/<name>.md`. The installer keeps a manifest of
every path it wrote, so it refuses to overwrite a file it does not own (use `--force` to
override) and `--uninstall` removes exactly those paths and nothing else.

Governance and Direction run at full capacity in all three. Only **Creation** degrades
outside Claude Code, because `frontend-design` and `ui-ux-pro-max-skill` are Claude-only
plugins. See [`adapters/kilo/README.md`](./adapters/kilo/README.md) and
[`adapters/codex/README.md`](./adapters/codex/README.md).

### From a local clone (Claude Code plugin development)

```bash
./install.sh --local       # or just ./install.sh for interactive
```

Your local edits reflect the next time Claude Code restarts.

### Installer flags

```bash
./install.sh                             # interactive
./install.sh --cli claude --local        # register this clone as a marketplace
./install.sh --cli claude --github       # register the GitHub repo as a marketplace
./install.sh --cli <claude|kilo|codex|all> --global|--project
./install.sh --cli <name> --force        # overwrite files this installer does not own
./install.sh --cli <name> --uninstall    # remove exactly what the installer wrote
```

### Uninstall

```bash
./install.sh --cli kilo --uninstall
# or, for Claude Code directly:
claude plugin uninstall steve-designer@steve-designer
claude plugin marketplace remove steve-designer
```

See [`docs/INSTALACAO.md`](./docs/INSTALACAO.md) for a step-by-step guide in Portuguese,
and [`docs/HELP.md`](./docs/HELP.md) for the day-to-day cheat sheet.

## The arsenal it orchestrates

The first two rows are Claude Code plugins — outside Claude Code they are reported as
degraded and Creation runs without them. The MCP servers exist in every CLI (Kilo declares
them in `kilo.json`, Codex in `.codex/config.toml`). Governance and Direction never depend
on any of this.

### Essential (install these for full capacity)

| Tool | Role |
|------|------|
| `anthropic/frontend-design` | Forces aesthetic direction in build phase |
| `nextlevelbuilder/ui-ux-pro-max-skill` | Design vocabulary library |
| `context7` MCP | Up-to-date library docs (Motion, Next.js, etc.) |
| `playwright` MCP | Visual checkpoints via screenshots |
| `chrome-devtools` MCP | Performance profiling in polish |

### Polish pipeline

| Tool | Role |
|------|------|
| `baseline-ui` skill | Spacing, typography, states |
| `fixing-accessibility` skill | Keyboard, focus, semantic HTML |
| `fixing-motion-performance` skill | Reduced-motion, 60fps budget |

See `skills/steve-designer/references/arsenal.md` for the full inventory and install
commands.

## Design philosophy

steve-designer's goal is to prevent the three most common failures of AI-assisted design:

1. **"Modern, clean, minimal"** — generic adjectives become generic output. steve-designer
   pushes back on vague vibes and demands specificity.
2. **Averaging references** — picking 3 safe references produces the average of those
   references. steve-designer always proposes one improbable combination.
3. **Tokens-last** — building components and then extracting tokens produces drift.
   steve-designer defines tokens before components, every time.

It's also the craft of *resistance*. Awwwards-style is wrong for SaaS dashboards,
conversion-first e-commerce, and high-trust financial products. steve-designer matches
reference style to use-case — see `references/when-to-resist-awwwards.md`.

Once a design system is governed, the same discipline applies in reverse: the gate is
git-level (pre-commit + CI), so it holds regardless of which agent or tool wrote the code
— Claude, Kilo, Codex, or a human.

## Structure

The **single source** is `skills/steve-designer/` — self-contained and portable. The
Claude Code adapter stays at the root (the plugin layout is fixed by convention), and
`scripts/build_dist.mjs` renders the Kilo and Codex bundles from that one source.

```
steve-designer/
├── skills/steve-designer/          # THE SINGLE SOURCE
│   ├── SKILL.md                    # The brain
│   ├── references/                 # Catalogs, capabilities map, playbooks, arsenal
│   ├── templates/                  # Brief, design-doc, AGENTS.md, CI, pre-commit, MCP
│   ├── scripts/                    # lint, arsenal, ingest, preview, hook helpers + tests
│   └── commands/                   # Generated into the bundle from commands/ below
├── adapters/
│   ├── kilo/                       # Kilo README + kilo.json MCP template
│   └── codex/                      # Codex README + mcp.toml + hooks.json templates
├── scripts/build_dist.mjs          # Renders dist/kilo and dist/codex from the source
├── .claude-plugin/                 # Claude adapter — plugin + marketplace manifests
├── commands/                       # Claude adapter — /steve-designer:* (source of the workflows)
├── agents/                         # Claude adapter — subagent prompts
├── hooks/                          # Claude adapter — PostToolUse design-lint hook
├── install.sh                      # Multi-CLI installer (claude | kilo | codex)
└── dist/                           # Generated bundles (gitignored)
```

The eight commands: `start`, `resume`, `enforce`, `check`, `build`, `handoff`, `arsenal`,
`help`. `guard` and `patrol` were removed in 0.4.0.

## Status

**Version 0.4.0.** Multi-CLI: the same portable law in Claude Code, Kilo, and Codex.
Creation mode is battle-tested; Governance and Direction run at full capacity in every
CLI. If a reference is wrong, a catalog entry is missing, or a subagent produces something
off, flag it — the skill improves by running.

See [`CHANGELOG.md`](./CHANGELOG.md) for release history.

## Contributing

Issues and PRs welcome. The highest-leverage contribution is extending the
reference catalogs in `skills/steve-designer/references/` — every entry follows
the DNA format documented in [`CONTRIBUTING.md`](./CONTRIBUTING.md). Please
open an issue before sending a PR for anything larger than a fix.

## License

MIT — see [`LICENSE`](./LICENSE).
