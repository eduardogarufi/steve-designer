# Contributing to steve-designer

Thanks for wanting to improve steve-designer. This document explains what kinds
of contributions are welcome, how to propose changes, and — most importantly —
how to contribute to the **reference catalogs**, which is where the project's
quality is made or broken.

## Ground rules

1. **File an issue first** for anything larger than a typo or obvious bug fix.
   Ideas are cheap, reviewer attention is not.
2. **One concern per PR.** Catalog additions, installer changes, and workflow
   edits do not belong in the same branch.
3. **Real usage beats speculation.** Prefer changes informed by an actual design
   project you ran through steve-designer over hypothetical improvements.

## Repository layout

```
steve-designer/
├── .claude-plugin/plugin.json      # plugin manifest (Claude adapter — stays at the root)
├── .claude-plugin/marketplace.json # marketplace manifest
├── agents/                         # subagent prompts (tokens, build, critic, enforcer)
├── commands/                       # slash commands (Claude adapter)
├── hooks/                          # PostToolUse design-lint hook (Claude adapter)
├── adapters/                       # per-CLI sources for Kilo and Codex
│   ├── kilo/                       # README + kilo.json MCP template
│   └── codex/                      # README + hooks/MCP TOML templates
├── scripts/                        # repo-level tooling (build_dist)
├── skills/steve-designer/          # THE SINGLE SOURCE — self-contained and portable
│   ├── SKILL.md                    # the brain
│   ├── references/                 # catalogs, capabilities.md — see below
│   ├── scripts/                    # lint, arsenal, ingest, preview helpers + tests
│   └── templates/                  # brief, design-doc, AGENTS.md, CI, pre-commit, MCP
├── docs/                           # user-facing install docs (HELP.md, INSTALACAO.md)
└── install.sh                      # multi-CLI installer (claude | kilo | codex)
```

The Claude Code plugin layout is fixed by convention, so the Claude adapter
(`.claude-plugin/`, `commands/`, `agents/`, `hooks/`) stays at the repository
root. Everything portable lives inside `skills/steve-designer/`; `adapters/`
holds only the per-CLI glue for Kilo and Codex, and `scripts/build_dist.mjs`
renders `dist/kilo/` and `dist/codex/` from that single source.

## Local setup

1. Clone the repo.
2. Register it as a local marketplace and install it:
   ```bash
   cd /path/to/steve-designer
   ./install.sh --local
   ```
3. Restart Claude Code, start a new session in any project, and run
   `/steve-designer:start` (or `/steve-designer:enforce` on an existing codebase) to
   exercise the change.

For a one-shot sanity check on the plugin structure, the CI workflow runs:
- `python3` validation of `.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json`
- `shellcheck` on every shell script
- a structure check for the required commands, agents, and scripts
- `node --test scripts/build_dist.test.mjs`
- `node --test skills/steve-designer/scripts/design_lint.test.mjs skills/steve-designer/scripts/design_lint.cli.test.mjs`
- `python3 skills/steve-designer/scripts/test_ingest.py`
- a syntax check of `install.sh` (`bash -n install.sh`, `install.sh --help`)

Reproduce it locally before opening a PR.

## Commit style

- Conventional commit prefixes are nice but not required.
- Keep the subject ≤72 characters, imperative mood ("Add Pitch to catalog", not
  "Added Pitch").
- In the body, explain **why** — the "what" is already in the diff.

## Reference catalog contributions

This is the highest-leverage way to contribute. Catalogs live in
`skills/steve-designer/references/`:

- `awwwards-dna.md` — canonical **web** references
- `app-references.md` — canonical **app** references
- `when-to-resist-awwwards.md` — use-cases where high-personality styling hurts
- `anti-patterns.md` — what produces AI-generic output

### What makes a good entry

Every entry in the catalogs follows the **DNA format**. An entry is not a
pretty site; it is a *documented decision*. If you can't articulate what a
reference is doing under the hood, don't add it yet.

A good entry has:

1. **Name and URL** — one line.
2. **DNA** — 2–5 sentences describing *what the reference is doing*, not how
   it feels. Talk about structure, type system, palette discipline, motion
   philosophy, density choices. Adjectives ("clean", "modern", "beautiful") are
   banned — they are the exact words steve-designer pushes back on during
   Discovery.
3. **Pull from X when** — what kinds of projects this reference genuinely fits.
4. **Don't pull from X when** — the equally important anti-use case. Every
   canonical reference has one.

### Template

````markdown
### <Name> — <url>
**DNA:** <2–5 sentences, concrete. Mention specific type choices, grid
decisions, motion timings, palette discipline, illustration style. Avoid
adjectives.>
**Pull from <Name> when:** <project characteristics that match>.
**Don't pull from <Name> when:** <project characteristics that don't>.
````

### Concrete example (from `awwwards-dna.md`)

````markdown
### Linear — linear.app
**DNA:** Monochrome palette with one saturated accent (violet). Inter
tightened to -0.02em, heavy on variable weight contrast. Information density
treated as a feature, not a problem. No rounded corners on layout, only on
interactive elements. Motion is sub-200ms, nearly subliminal. Deliberately
fewer pixels than the user expects.
**Pull from Linear when:** the project values precision, speed, and
information density. SaaS for technical users.
**Don't pull from Linear when:** the audience is consumer-first or emotional.
Linear is cold by design.
````

### How to propose a new reference

1. Open an issue using the **"Reference catalog addition"** template.
2. If the entry is accepted, send a PR that:
   - adds the entry to the correct section of the correct catalog
     (match the existing organization — "Editorial restraint", "High
     personality", "Density with calm", etc.);
   - keeps entries alphabetized inside their section unless a deliberate
     ordering exists;
   - does not rewrite or reorganize unrelated entries.

### Things we will push back on

- **Personal favorites without a thesis.** "It's cool" is not a DNA.
- **Trend-chasing.** If a reference is popular this quarter but its DNA is
  shallow, we'd rather wait.
- **Redundancy.** Two entries that would lead steve-designer to propose the
  same synthesis do not both need to exist.
- **Adjective-heavy writing.** If the DNA reads like a Dribbble caption, it
  gets sent back for rewriting.

## Subagent and orchestration changes

Changes to files in `agents/`, `commands/`, or `SKILL.md` affect every user's
design session. Before proposing one:

1. Run at least one real design session end-to-end with the change in place.
2. Include a note in the PR describing the session you ran and what got better.
3. For behavioral changes, update `CHANGELOG.md` under `[Unreleased]`.

## Installer and tooling changes

- `install.sh` changes must pass the CI dry-run (see `.github/workflows/ci.yml`).
- Shell scripts must pass `shellcheck -S warning`.
- The installer must never ship repo-meta (`.git`, `docs`, `README.md`,
  `LICENSE`, `CHANGELOG.md`, `CONTRIBUTING.md`) into the installed plugin
  directory.

## Releasing (maintainers)

1. Land all changes into `main`.
2. Move the `[Unreleased]` section of `CHANGELOG.md` under a new version heading.
3. Bump `version` in `.claude-plugin/plugin.json`.
4. Tag: `git tag v<version> && git push --tags`.
5. Create a GitHub release from the tag with the CHANGELOG section as body.

## License

By contributing, you agree that your contributions will be licensed under the
MIT License in `LICENSE`.
