# steve-designer

**An agentic design director for Claude Code.**

steve-designer doesn't replace your design plugins — it *orchestrates* them. It conducts the strategic conversation that prevents AI-generic output, synthesizes references from Awwwards (for web) and Mobbin (for apps), defines your design tokens, then hands execution to `frontend-design`, `ui-ux-pro-max-skill`, Playwright, and the polish pipeline.

## What it does

1. **Arsenal check** — verifies your design tooling is installed, suggests what's missing
2. **Discovery** — 5 questions to capture vibe, audience, tension, constraints
3. **References** — proposes 3 canonical references with written DNAs, combines them into an improbable synthesis, accepts your own URLs and screenshots
4. **Tokens** — spawns a `tokens-engineer` subagent that outputs `design-tokens.ts`, Tailwind config, and a live preview swatch
5. **Build** — spawns `component-builder` subagents section-by-section, with Playwright screenshots at each checkpoint
6. **Polish** — orchestrates `/baseline-ui` → `/fixing-accessibility` → `/fixing-motion-performance` → `/design-review` → `design-critic`

Everything gets persisted to `design-brief.md` in your project root. You can leave and come back — `/steve-designer:resume` picks up where you left off.

## Install

### Quick install (run from inside the plugin directory)

```bash
./install.sh
```

You'll be asked whether to install as **personal** (every Claude Code session) or **project** (only this project).

### Non-interactive

```bash
./install.sh --personal    # ~/.claude/plugins/steve-designer
./install.sh --project     # ./.claude/plugins/steve-designer
```

### Manual

Copy the entire plugin folder to either:
- `~/.claude/plugins/steve-designer/` (personal)
- `./.claude/plugins/steve-designer/` (project)

Then restart Claude Code.

## Usage

```
/steve-designer:start       # new design session
/steve-designer:resume      # continue from design-brief.md
```

On first run, steve-designer will check your arsenal. Install what it recommends for full capacity. It can operate in degraded mode without the essentials, but the quality bar drops measurably.

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

See `skills/steve-designer/references/arsenal.md` for the full inventory and install commands.

## Design philosophy

steve-designer's goal is to prevent the three most common failures of AI-assisted design:

1. **"Modern, clean, minimal"** — generic adjectives become generic output. steve-designer pushes back on vague vibes and demands specificity.
2. **Averaging references** — picking 3 safe references produces the average of those references. steve-designer always proposes one improbable combination.
3. **Tokens-last** — building components and then extracting tokens produces drift. steve-designer defines tokens before components, every time.

It's also the craft of *resistance*. Awwwards-style is wrong for SaaS dashboards, conversion-first e-commerce, and high-trust financial products. steve-designer matches reference style to use-case — see `references/when-to-resist-awwwards.md`.

## Structure

```
steve-designer/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   └── steve-designer/
│       ├── SKILL.md              # The brain
│       ├── references/           # Canonical references, arsenal map, anti-patterns
│       └── templates/            # design-brief template
├── agents/
│   ├── tokens-engineer.md        # Spawned in Phase 4
│   ├── component-builder.md      # Spawned in Phase 5
│   └── design-critic.md          # Spawned in Phase 6
├── commands/
│   ├── start.md                  # /steve-designer:start
│   └── resume.md                 # /steve-designer:resume
├── scripts/
│   └── check_arsenal.sh          # Verifies installed tools
├── install.sh                    # Installer
└── README.md                     # This file
```

## Status

**Version 0.1.0 — early.** Core flow works; the `references/` catalog will expand as real projects exercise it. If a reference is wrong, a catalog entry is missing, or a subagent produces something off, flag it — the skill improves by running.

## License

MIT.
