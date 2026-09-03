# steve-designer

**The owner of a project's UI design system.**

In any project that invokes it, steve-designer creates the design system from scratch or
adopts an existing one; it directs every subsequent UI change — building it directly
through subagents, or handing a contract to another executor; it verifies any executor's
work — working tree, a commit, a range, or a PR — mechanically, semantically, and
visually; and it maintains the canonical documentation for the system in `docs/design/`.

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

**Deprecated aliases:** `/steve-designer:guard` → `enforce`, `/steve-designer:patrol` →
`check`. Both remain as thin, deprecation-warning aliases through the 0.3.x series;
removed in 0.4.

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

steve-designer is a Claude Code plugin. Install it with the built-in plugin CLI.

### From the CapitalTrend marketplace

```bash
claude plugin marketplace add CapitalTrendGroup/claude-marketplace
claude plugin install steve-designer@capitaltrendgroup-internal
```

> Publication to this marketplace is in progress. If the install fails, use one of the
> options below in the meantime.

### From GitHub

```bash
claude plugin marketplace add eduardogarufi/steve-designer
claude plugin install steve-designer@steve-designer
```

Then restart Claude Code.

### From a local clone (for plugin development)

```bash
git clone https://github.com/eduardogarufi/steve-designer.git
cd steve-designer
./install.sh --local       # or just ./install.sh for interactive
```

Your local edits reflect the next time Claude Code restarts.

### Installer flags

```bash
./install.sh               # interactive — asks local clone or GitHub
./install.sh --local       # register this directory as a marketplace
./install.sh --github      # register the GitHub repo as a marketplace
./install.sh --uninstall   # remove plugin + marketplace
```

### Uninstall

```bash
./install.sh --uninstall
# or
claude plugin uninstall steve-designer@steve-designer
claude plugin marketplace remove steve-designer
```

See [`docs/INSTALACAO.md`](./docs/INSTALACAO.md) for a step-by-step guide in Portuguese,
and [`docs/HELP.md`](./docs/HELP.md) for the day-to-day cheat sheet.

## The arsenal it orchestrates

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
— Claude, Codex, or a human.

## Structure

```
steve-designer/
├── .claude-plugin/
│   ├── plugin.json               # Plugin manifest
│   └── marketplace.json          # Marketplace manifest (makes this repo installable)
├── skills/
│   └── steve-designer/
│       ├── SKILL.md              # The brain
│       ├── references/           # Canonical references, capabilities map, playbooks
│       └── templates/            # Brief, manifest, decisions, handoff templates
├── agents/
│   ├── tokens-engineer.md        # Spawned in Creation, Phase 4
│   ├── component-builder.md      # Spawned in Creation Phase 5, and in Direction (build)
│   ├── design-critic.md          # Spawned in Creation Phase 6, and in check --visual
│   └── design-enforcer.md        # Spawned in check (Governance)
├── commands/
│   ├── arsenal.md                # /steve-designer:arsenal
│   ├── start.md                  # /steve-designer:start
│   ├── resume.md                 # /steve-designer:resume
│   ├── enforce.md                # /steve-designer:enforce
│   ├── check.md                  # /steve-designer:check
│   ├── build.md                  # /steve-designer:build
│   ├── handoff.md                # /steve-designer:handoff
│   ├── help.md                   # /steve-designer:help
│   ├── guard.md                  # deprecated alias → enforce
│   └── patrol.md                 # deprecated alias → check
├── scripts/
│   ├── check_arsenal.sh          # Verifies installed tools (supports --install)
│   ├── init_project_brief.py     # Seeds docs/design/brief.md
│   ├── ingest_design_system.py   # Detects stack, emits docs/design/manifest.json
│   ├── design_lint.mjs           # Blocking linter (--changed/--commit/--range/--pr)
│   ├── steve_paths.py            # Shared manifest/brief path resolution
│   └── start_preview.sh          # Local preview server
├── hooks/                        # design-lint pre-commit / edit hook
├── templates/                    # AGENTS.md, CI, pre-commit, MCP config templates
├── install.sh                    # Installer wrapper (marketplace add + install)
└── README.md                     # This file
```

## Status

**Version 0.3.0.** Creation mode is battle-tested; Governance and Direction modes
(Sheriff Mode + the design-doc/manifest ownership model) are new in this release. If a
reference is wrong, a catalog entry is missing, or a subagent produces something off,
flag it — the skill improves by running.

See [`CHANGELOG.md`](./CHANGELOG.md) for release history.

## Contributing

Issues and PRs welcome. The highest-leverage contribution is extending the
reference catalogs in `skills/steve-designer/references/` — every entry follows
the DNA format documented in [`CONTRIBUTING.md`](./CONTRIBUTING.md). Please
open an issue before sending a PR for anything larger than a fix.

## License

MIT — see [`LICENSE`](./LICENSE).
