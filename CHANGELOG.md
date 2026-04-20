# Changelog

All notable changes to **steve-designer** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- GitHub Actions CI (plugin.json validation, shellcheck, install.sh dry-run)
- `CHANGELOG.md`, `CONTRIBUTING.md`
- Issue templates (bug report, reference request, feature request) and PR template
- Installer excludes repo-meta (`.git`, `docs`, `LICENSE`, `README.md`, etc.) from installed plugin

### Fixed
- `install.sh` no longer bloats installed plugin with repository metadata

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
