# Changelog

All notable changes to **steve-designer** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/eduardogarufi/steve-designer/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/eduardogarufi/steve-designer/releases/tag/v0.1.0
