# Changelog

All notable changes to **steve-designer** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.4.0 — 2026-09-22

### Added — the same design-system law in Claude Code, Kilo, and Codex

- **Multi-CLI distribution.** `skills/steve-designer/` is now the single, self-contained
  source; `scripts/build_dist.mjs` renders `dist/kilo/` and `dist/codex/` from it, and
  `install.sh` installs into any of the three CLIs:
  - **Kilo** — `skills/steve-designer/`, `command/steve-*.md`, `agent/steve-*.md`, and a
    `kilo.json` MCP fragment. No command namespacing, so the namespaced Claude form becomes
    `/steve-enforce`.
  - **Codex** — `.agents/skills/steve-designer/`, `.codex/agents/steve_*.toml`, an
    `mcp.toml` fragment merged into `config.toml` inside a marked block, and a
    `.codex/hooks.json` fragment.
- **Codex in-session hook**, using the schema Codex actually supports:
  `hooks.PostToolUse` with `matcher = "apply_patch|Edit|Write"`, a `command` handler, and
  `timeout` in seconds. The handler runs the portable `hook_design_lint.sh`, which is silent
  on an ungoverned project and reports a violation via stderr + exit 2. Convenience only —
  the git-level gate remains the guarantee. Non-managed hooks must be trusted via `/hooks`.
- **Kilo commands, agents, and skill.** Kilo has no `hooks.json`, so by decision Kilo runs
  without an in-session hook and relies on pre-commit + CI + `/steve-check`.
- **Thin per-CLI command dispatchers.** The command workflows are copied into the installed
  skill at `commands/<name>.md`; the Kilo and Codex command files only load the skill and
  run the named workflow. This removes the dangling references the previous approach created.
- **Anchored paths.** Every skill-owned reference in a bundle is anchored to
  `<STEVE_SKILL_DIR>`, which `install.sh` replaces with the absolute installed skill path.
  A generated command therefore runs correctly no matter which directory the CLI was started
  in. The one deliberate exception is `scripts/design_lint.mjs`, which `enforce` vendors into
  the governed project and which must stay project-relative.
- **CLI-aware arsenal.** `check_arsenal.sh --cli claude|kilo|codex` detects the CLI and
  reports `frontend-design` / `ui-ux-pro-max-skill` as **degraded** rather than missing
  outside Claude Code; it no longer exits 2 just because `claude` is absent. Exit 2 now
  means "no supported CLI detected". Bundles pin the flag so auto-detection cannot pick a
  different CLI, and the project-scope `.kilo/kilo.json` is inspected.
- `adapters/kilo/` and `adapters/codex/` — per-CLI READMEs plus the MCP and hook templates.
- `scripts/build_dist.test.mjs` — covers path anchoring, the vendored-linter exception,
  placeholder leakage, bundle self-containment, exec-bit preservation, and idempotency.

### Changed

- **Single source.** `scripts/**` and the enforcement templates moved into
  `skills/steve-designer/` (`scripts/` and `templates/`), so an installed skill carries
  everything it needs.
- **Ownership-based installer.** Kilo and Codex installs record every written path in
  `.steve-designer-manifest.json`. Install refuses to overwrite a file it does not own
  (override with `--force`); `--uninstall` deletes exactly the manifest's paths, plus only
  the config entries the installer itself added. Namespace-wide globs are no longer used as
  an ownership mechanism.
- **Safe configuration merging.** `kilo.json`, `.codex/hooks.json`, and the `config.toml`
  MCP block are merged key-aware and written atomically: an existing server or hook is kept,
  never duplicated, and the TOML result is validated before the original is replaced. An
  unterminated managed block is refused rather than silently edited. `python3` is now a
  documented prerequisite for Kilo/Codex installs, and the installer fails early if it is
  missing instead of half-configuring.
- `install.sh` is now multi-CLI: `--cli <claude|kilo|codex|all>`, `--global|--project`,
  `--local|--github`, `--uninstall`, `--force`.
- README, `docs/HELP.md`, `docs/INSTALACAO.md`, and `CONTRIBUTING.md` document the layout,
  the per-CLI entry points, and what degrades.
- The Claude Code adapter (`.claude-plugin/`, `commands/`, `agents/`, `hooks/`) **stays at
  the repository root** — the plugin layout is fixed by convention.

### Breaking

- **`guard` and `patrol` removed**, as announced for 0.4.0. Use `enforce` and `check`.
  They are not re-created in Kilo or Codex.
- `install.sh` flags changed. `./install.sh --local` still works for Claude Code; the
  bare `--uninstall` now needs `--cli <name>` (or use `--cli all --uninstall`).
- No Codex custom prompts are shipped. Codex custom prompts are user-level and deprecated
  upstream in favour of skills; the invocation is `$steve-designer <command>`.

### Migration

- Claude Code users: nothing to do beyond updating the plugin; governed projects keep
  working with the same `docs/design/` layout, `AGENTS.md`, vendored `design_lint.mjs`, and
  pre-commit/CI wiring.
- Kilo/Codex users: `git clone` this repo and run
  `./install.sh --cli <kilo|codex> --global|--project`, then restart the CLI. If a previous
  0.3-era file-based install exists, remove it first — this installer will refuse to
  overwrite files it does not own rather than guess.
- Anyone scripting `./install.sh --uninstall`: add `--cli claude`.

## 0.3.0 — 2026-09-03

### Added — Steve owns the UI design system (Governance renamed, Direction mode)

- **BREAKING renames.** `/steve-designer:guard` → `/steve-designer:enforce`,
  `/steve-designer:patrol` → `/steve-designer:check`. The old names remain as thin
  deprecation-warning aliases (`commands/guard.md`, `commands/patrol.md`) through the
  0.3.x series; removed in 0.4.0.
- **`/steve-designer:build`** — Direction mode: Steve reads the manifest and design doc,
  assembles the screen contract (allowed components, required states, tokens by role,
  i18n keys, "cravado" rules), and builds or conforms the screen via `component-builder`.
  Ends by running `check`.
- **`/steve-designer:handoff`** — the same contract as `build`, delivered as a prompt for
  an external executor (Claude, Codex, v0, Lovable, a human), saved under
  `docs/design/handoffs/<date>-<screen>.md`.
- **`/steve-designer:help`** — prints `skills/steve-designer/references/capabilities.md`
  verbatim, the canonical machine-and-human-readable capability map; also serves
  `AGENTS.md` and any agent reading Steve's contract cold.
- **`docs/design/` as the canonical documentation home**, replacing scattered root-level
  artifacts: `design-doc.md`, `brief.md`, `manifest.json`, `contrast.md`, `screens.md`,
  `decisions.md`, `handoffs/`. Legacy root paths (`design-brief.md`,
  `design-system-manifest.json`) are still resolved as a fallback via the new
  `scripts/steve_paths.py`; if both a legacy and a `docs/design/` path exist, every
  command stops and names both rather than guessing.
- **Manifest `schemaVersion: 2`.** Adds `tokens.feedback`, `tokens.typography`,
  `tokens.zIndex`, `tokens.breakpoints` to the token inventory.
- **BREAKING — feedback token routing moved.** `tokens.color.*` no longer carries
  feedback colors (success/warning/error/info); they now live under
  `tokens.feedback.*`. `design_lint.mjs` reads `tokens.feedback` for v2 manifests and
  falls back to the old `tokens.color` location for v1 manifests, but a v2 manifest
  written with feedback colors still under `tokens.color` will not be recognized as
  feedback tokens.
- **`no-literal-jsx-string` lint rule** — flags literal JSX text and literal i18n
  attributes, active only when `manifest.i18n.enabled === true`.
- **Scoped `/steve-designer:check`.** Four scopes: working tree (default, staged +
  unstaged + untracked), `--commit <sha>`, `--range <a>..<b>`, `--pr <n>` (resolved via
  `gh pr view`; requires local `HEAD` to equal the PR's `headRefOid`, or it fails with
  the exact checkout instruction — it never checks out the PR for you). Layers: lint
  (blocks) → `design-enforcer` (severity-rated findings) → `design-critic` visual pass
  when a preview URL is available or `--visual` is passed.
- **Exit codes 0/1/2 for `design_lint.mjs`**: `0` clean, `1` violations found (build
  blocked), `2` scope/manifest resolution error (e.g. two manifests present).
- **`agents/design-enforcer.md`** — reviews a UI diff against the manifest and
  `AGENTS.md` for violations the mechanical linter cannot catch (wrong component choice,
  token used in the wrong semantic role, invented prop, drift from the synthesis
  statement). Read-only; reports severity, does not edit.
- **New templates**: `templates/design-system-manifest.template.json`,
  `skills/steve-designer/templates/design-doc.template.md`,
  `skills/steve-designer/templates/decisions.template.md`,
  `skills/steve-designer/templates/handoff.template.md`,
  `skills/steve-designer/templates/screens.template.md`.
- **New reference**: `skills/steve-designer/references/capabilities.md`, the canonical
  command/artifact map served verbatim by `/help`.
- **`design_lint.mjs --manifest`** flag to point at an explicit manifest path, on top of
  the existing resolution order.
- **`ingest_design_system.py --manifest`** as an alias of `--out`.
- **CI: optional axe accessibility check** in `templates/ci-design-check.template.yml`
  for projects that adopt the gate.
- **`design_lint.mjs --version`** prints `design-lint 0.3.0`. `/steve-designer:check` and
  `/steve-designer:enforce` run this handshake before touching a new scope, and refuse (or
  offer to update the vendored copy) on anything older.
- **`design_lint.mjs --emit-scope <path>`** writes the resolved scope as JSON
  (`{mode, base, head, files, diff, manifest, lintVersion}`) so `check` resolves the scope
  once and its `design-enforcer`/`design-critic` layers read the same snapshot instead of
  re-running `git diff`.
- **Fail-closed flag parsing.** An unknown flag, a flag missing its value, or two scope
  flags passed together now exits `2` (configuration/scope failure) instead of silently
  misparsing.
- **Atomic manifest/brief migration in `enforce`.** A legacy-root file with no
  `docs/design/` counterpart is moved with `git mv` before INGEST runs; if both exist,
  `enforce` stops, shows the diff, and asks the user to choose instead of leaving both in
  place.
- **`docs/design/capabilities.md`** — `enforce` now copies
  `skills/steve-designer/references/capabilities.md` into every governed project, so any
  agent can read Steve's capability map without the plugin. `AGENTS.md` and every other
  in-project pointer now target this copy; `/steve-designer:help` still prints the
  plugin's source copy.
- **Closed lint bypasses**: multi-line imports, string literals inside `{"..."}`
  expressions, and string literals in JSX attributes no longer slip past
  `no-unknown-component` / `no-literal-jsx-string`.

### Changed

- `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` description now
  reflects the three modes and "owns the UI design system of any project" instead of
  only the Creation flow.
- CI (`.github/workflows/ci.yml`) now installs Node.js 20 via `actions/setup-node@v4`
  and runs `node --test scripts/design_lint.test.mjs scripts/design_lint.cli.test.mjs`
  and `python3 scripts/test_ingest.py`, and the structure check verifies the current 10
  commands and 4 agents instead of the original 3-command, 3-agent set.

## 0.2.0 — 2026-06-23

### Added — Sheriff Mode (design-system enforcement)

- `/steve-designer:guard` — one-time setup: ingest the DS, generate `AGENTS.md`, install the hard gate (pre-commit + CI), configure ≤3 MCPs for Claude + Codex.
- `/steve-designer:patrol` — on-demand enforcement: mechanical `design-lint` + `design-enforcer` semantic review.
- `scripts/ingest_design_system.py` — auto-detects stack (shadcn / own-primitives / tailwind-css) and emits `design-system-manifest.json` (tokens, components+props, packages).
- `scripts/design_lint.mjs` — blocking linter: no hardcoded hex, no off-scale spacing, no unknown components.
- `agents/design-enforcer.md`, `hooks/design-lint-hook.sh`, and AGENTS.md / MCP / pre-commit / CI templates.
- Cross-tool: enforcement lives in git-level artifacts, so it holds in both Claude Code and Codex.

### Added — Brownfield support (Governance works on existing repos)
- **Configurable design-system sources.** `ingest_design_system.py` reads an optional `steve.config.json` (or a `steveDesigner` field in `package.json`) with `dsSources` (`{dir, package}`), and otherwise auto-detects workspace-package design systems (a package whose `exports` map points at `.tsx`, e.g. `@vinci/ui`) in addition to the greenfield `components/ui/` convention. Components are extracted from real exports (`export function|const <PascalCase>`), not a fixed path.
- **`dsImportPrefixes` in the manifest.** The ingester emits the import matcher (e.g. `["@vinci/ui", "@vinci/ui/*"]`); `design_lint.mjs` builds `no-unknown-component` from it, so the rule now enforces against package specifiers, not only `components/ui/` paths. Legacy manifests without the field fall back to the old path matcher.

### Fixed
- **Stack detection contradiction.** A token-based repo with no Tailwind is now classified `token-css` (or `css-modules`) with `tailwind: false`, instead of the impossible `tailwind-css` + `tailwind: false`. Tailwind is only asserted on a real signal (dependency, `tailwind.config.*`, or a CSS `@import "tailwindcss"`).
- **`--changed` false-green.** It now scans the whole working tree (staged **+** unstaged **+** untracked) instead of only the staged diff, so uncommitted work can no longer slip through as "clean".
- **Destructive `guard`/`enforce`.** On brownfield repos `enforce` (née `guard`) now merges or skips `AGENTS.md`, `CLAUDE.md`, `scripts/design_lint.mjs`, the pre-commit hook, CI, `.mcp.json`, and the manifest whitelist — never clobbering an existing constitution — and reports every create/merge/skip decision.
- **Silent critique agents.** `design-enforcer` and `design-critic` now carry a hard output contract: the final message IS the report (empty/"Done." = failure), and they also write it to an `OUTPUT_FILE` that `check` (née `patrol`) reads as a durable fallback.

### Changed (BREAKING)
- **Install flow completely rewritten.** Claude Code does not auto-discover
  plugins dropped into `~/.claude/plugins/`; they must be registered via
  `claude plugin marketplace add` + `claude plugin install`. The previous
  "copy folder to `~/.claude/plugins/steve-designer`" flow never actually
  registered commands with Claude Code.
- `install.sh` no longer copies files. It now:
  - validates `claude` CLI is on PATH,
  - registers the plugin as a marketplace (from a local clone or from GitHub),
  - runs `claude plugin install steve-designer@steve-designer`.
- New flags: `--local`, `--github`, `--uninstall`. The old `--personal` /
  `--project` flags are **removed**; users who relied on them need to re-run
  `./install.sh` (interactive) or pick a new flag.
- Users who previously manual-copied steve-designer to `~/.claude/plugins/`
  should remove that directory: `rm -rf ~/.claude/plugins/steve-designer`,
  then install via the new flow.

### Added
- `.claude-plugin/marketplace.json` — makes the repo a valid Claude Code
  marketplace (required for registration).
- `/steve-designer:arsenal` slash command — checks prerequisites and, on
  confirmation, installs whatever is missing.
- `check_arsenal.sh --install` flag (with `-y` / `--yes` for non-interactive
  mode) runs the install commands end-to-end instead of only printing them.
- GitHub Actions CI: validates `plugin.json` + `marketplace.json`, runs
  shellcheck, verifies required plugin structure, and syntax-checks
  `install.sh`. Runs on Node.js 24 via `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`.
- `CHANGELOG.md`, `CONTRIBUTING.md`.
- Issue templates (bug report, reference request, feature request) and PR
  template.

### Fixed
- Shellcheck SC2034 warnings in `scripts/start_preview.sh` (unused loop vars).

## [0.1.0] — 2026-04-20

### Added
- Initial public release
- Six-phase orchestration flow: Arsenal Check → Discovery → References → Tokens → Build → Polish
- Commands: `/steve-designer:start`, `/steve-designer:resume`
- Subagents: `tokens-engineer`, `component-builder`, `design-critic`
- Reference catalogs: `awwwards-dna.md`, `app-references.md`, `when-to-resist-awwwards.md`,
  `arsenal.md`, `anti-patterns.md`, `phase-playbook.md`, `orchestration-map.md`
- Templates: `design-brief.template.md`, `final-prompt.template.md`, `claude-md-snippet.template.md`
- Scripts: `check_arsenal.sh`, `init_project_brief.py`, `start_preview.sh`
- MIT license, plugin manifest (`.claude-plugin/plugin.json`)
- Installer with `--personal` / `--project` modes

[0.3.0]: https://github.com/eduardogarufi/steve-designer/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/eduardogarufi/steve-designer/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/eduardogarufi/steve-designer/releases/tag/v0.1.0
