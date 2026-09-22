# Steve Designer — capabilities

The canonical, machine-and-human-readable map of what Steve does. `/steve-designer:help`
prints this file verbatim (from the plugin — the origin copy). `enforce` copies it into
every governed project at `docs/design/capabilities.md`, and the `AGENTS.md` Steve
generates points there. Any agent — Claude, Codex, a human, another tool — can read the
project's copy cold and know how to work with Steve without touching the plugin.

## What Steve is

Steve-designer is the **owner of a project's UI design system**. In any project that
invokes it, Steve creates the design system from scratch, or adopts an existing one; it
directs every subsequent UI change — building it directly through subagents, or handing a
contract to another executor; it verifies any executor's work — working tree, a commit, a
range, or a PR — mechanically, semantically, and visually; and it maintains the canonical
documentation for the system in `docs/design/`.

## The three modes

- **Criação (Creation)** — builds a design system and the UI on it from zero: arsenal →
  discovery → references → tokens → build → polish.
- **Governança (Governance)** — adopts an existing codebase's design system (`enforce`)
  and verifies changes against it (`check`).
- **Direção (Direction)** — drives a specific UI change on an already-governed project,
  either by building it (`build`) or by handing a contract to another executor
  (`handoff`).

## Command table

| Command | Mode | What it does | What it reads | What it writes | Return contract |
|---|---|---|---|---|---|
| `start` | Creation | Runs the full six-phase flow from zero: arsenal check, discovery, references, tokens, build, polish. | User brief, `references/*.md`, any existing `docs/design/` content. | `docs/design/brief.md`, `docs/design/manifest.json`, `docs/design/design-doc.md`, `docs/design/contrast.md`, built UI files. | Summary of phases completed, paths to every artifact created, next recommended command. |
| `resume` | Creation | Resumes an interrupted Creation flow from the brief. Resolves the brief at `docs/design/brief.md`, falling back to `design-brief.md` at the project root. | `docs/design/brief.md` (or the legacy fallback), any partial tokens/build artifacts. | Same as `start`, continuing from the resolved phase. | Which phase it resumed at, what remains, paths touched. |
| `enforce` | Governance | One-time-per-repo adoption: atomic legacy→`docs/design/` migration → INGEST (scan the codebase for an existing design system) → CODIFY (write the manifest and design doc) → gate (install the lint hook / pre-commit / CI, offer to update a stale vendored linter). | Existing source (`.tsx`/`.jsx`/`.css`/config), `steve.config.json` if present. | `docs/design/manifest.json`, `docs/design/design-doc.md`, `docs/design/contrast.md`, `docs/design/capabilities.md`, root `AGENTS.md` (pointed at `docs/design/`), pre-commit hook, CI workflow. | List of tokens/components ingested, gate installed y/n, path to the generated `design-doc.md`, migrations performed. |
| `check` | Governance | Verifies a UI change against the governed system. First checks the linter's `--version` (≥ `0.3.0` required). Scopes: working tree (default), `--commit <sha>`, `--range <a>..<b>`, `--pr <n>` — resolved once via `--emit-scope` and reused by every layer. Layers: lint (blocks) → `design-enforcer` (severity-rated findings) → `design-critic` visual pass when a preview URL is available or `--visual` is passed. | `docs/design/manifest.json` (with legacy fallback), the `--emit-scope` snapshot (`.steve/check-scope.json`), `AGENTS.md`. | `.steve/check-scope.json`, `.steve/check-enforcer.md`, `.steve/check-critic.md` when the critic runs. | Lint exit status (0/1/2, fail-closed on any flag or scope error), enforcer findings (Blocking/Warnings/Clean), critic scores when run, overall pass/fail. |
| `build` | Direction | Steve directs one UI change on a governed project. Reads the manifest and design doc, assembles the **screen contract** (allowed components, required states, tokens by role, i18n keys, any "cravado"/paid rules that apply), and builds it via `component-builder`, or conforms an existing screen to the contract. Ends by running `check`. | `docs/design/manifest.json`, `docs/design/design-doc.md`, `docs/design/screens.md`. | The built/conformed screen files, an updated row in `docs/design/screens.md`, a `check` run. | Screen contract used, files changed, `check` result. |
| `handoff` | Direction | Same contract as `build`, but delivered as a **prompt for another executor** (any agent or tool, not necessarily Steve's own subagents). | Same as `build`. | `docs/design/handoffs/<date>-<screen>.md`, a row in `screens.md`. | Path to the handoff file; instructs the caller to return a diff for `check`. |
| `arsenal` | Transversal | Checks that the plugin's own toolchain (frontend-design, ui-ux-pro-max, Context7, Playwright) is present and reports what's missing. | Plugin/tool availability. | Nothing persistent. | Pass/fail per tool, degraded-mode notes. |
| `help` | Transversal | Prints this file verbatim. Serves both a human reading the terminal and an agent parsing for capabilities. | This file. | Nothing. | This file's content, unmodified. |

**Deprecated aliases:** `guard` → `enforce`, `patrol` → `check` were deprecated in 0.3.x and
**removed in 0.4.0**. Use `enforce` and `check`.

## Availability by CLI

Steve runs in Claude Code, Kilo, and Codex from the same source. The **law is portable** —
`AGENTS.md`, `docs/design/**`, `scripts/design_lint.mjs`, the pre-commit hook, and CI enforce
identically in every CLI, regardless of which agent wrote the code.

| Capability | Claude Code | Kilo | Codex |
|---|---|---|---|
| Command entry point | `/steve-designer:<cmd>` | `/steve-<cmd>` | `$steve-designer <cmd>` |
| Skill | plugin skill | `.kilo/skills/steve-designer/` | `.agents/skills/steve-designer/` |
| Subagents | `agents/*.md` | `agent/steve-*.md` | `.codex/agents/steve_*.toml` |
| In-session hook | PostToolUse | — (git gate only) | `PostToolUse` on `apply_patch` |
| Creation engines (`frontend-design`, `ui-ux-pro-max`) | available | degraded | degraded |
| Governance + Direction | full | full | full |

Install with `./install.sh --cli <claude|kilo|codex> [--global|--project]`. The `check`,
`enforce`, `build`, and `handoff` flows are identical in all three; only Creation degrades
outside Claude Code, and only the in-session warning differs for Kilo.

## Artifacts table

| Path | Owner | Contents |
|---|---|---|
| `docs/design/design-doc.md` | Steve | The canonical source: principles, tokens, voice, components, required states, screens pointer, accessibility, zero-hardcode rules, reference DS, "cravado" checklist, history. |
| `docs/design/brief.md` | Steve (Creation) | Memory of the Creation phases — discovery, references, voice and copy decisions. Legacy path: `design-brief.md` at the project root. |
| `docs/design/manifest.json` | Steve | Machine inventory: tokens (incl. feedback/typography/zIndex/breakpoints in v2), components + props + states + a11y, i18n config, voice config. Legacy path: `design-system-manifest.json` at the project root. |
| `docs/design/contrast.md` | `tokens-engineer` | The fg×bg contrast matrix computed against WCAG 2.1, plus the explicit forbidden-pairs list. |
| `docs/design/screens.md` | Steve (`build`/`handoff`) | Matrix: screen → route → components → required states → origin (Creation vs. Direction). |
| `docs/design/decisions.md` | Steve, `component-builder` (halt-and-ask) | History: version · date · author · change · lesson. Also the queue of pending design decisions raised by halt-and-ask. |
| `docs/design/handoffs/` | Steve (`handoff`) | One file per contract delivered to an external executor, named `<date>-<screen>.md`. |
| `docs/design/capabilities.md` | Steve (`enforce`) | Copy of this capability map, so any agent in the project can read Steve cold without the plugin. Overwritten only when unchanged from the last template, or with confirmation. |
| `AGENTS.md` (project root) | Steve (`enforce`) | The project-wide law: points to `docs/design/` and to `docs/design/capabilities.md`; states the handoff-before/check-after rule. |

## How another agent uses Steve without the plugin

An agent that has never heard of the steve-designer plugin still operates under Steve's
law on a governed project, in three steps:

1. **Read `AGENTS.md`** at the project root. It states the rule plainly and points to
   `docs/design/` and to `docs/design/capabilities.md`.
2. **Ask for a `handoff` contract before writing UI.** Don't invent a screen's tokens,
   components, or copy — request the contract (or read the one already produced under
   `docs/design/handoffs/`).
3. **Run `node scripts/design_lint.mjs --changed` before committing.** The pre-commit
   hook and the CI gate run this regardless of which agent or tool wrote the code — it is
   not bypassed by not using the plugin.

## Scopes of `check`

| Scope | Flag | Resolution |
|---|---|---|
| Working tree | (default) | Staged + unstaged + untracked files. |
| Commit | `--commit <sha>` | The diff introduced by that commit (root commits handled). |
| Range | `--range <a>..<b>` | The literal `a..b` diff. |
| Pull request | `--pr <n>` | Resolves `baseRefOid`/`headRefOid` via `gh pr view`. |

**§13.5 rule:** `--pr` requires the local `HEAD` to equal the PR's `headRefOid` — if it
doesn't, `check` fails with the exact checkout instruction. It never checks out the PR
for you.

**Manifest override policy:** explicit `--manifest` wins; otherwise `docs/design/manifest.json`,
then legacy root; both present = stop and run `enforce` to migrate.

**Linter capabilities (`design-lint 0.3.0`):** `node scripts/design_lint.mjs --version`
prints the linter's version — `check` refuses to run a new scope against anything below
`0.3.0`. `--emit-scope <path>` writes the resolved scope (`{mode, base, head, files, diff,
manifest, lintVersion}`) to a JSON file so `check`'s layers 2 and 3 read the same snapshot
instead of re-deriving the diff. Exit `2` fires on any configuration or scope failure,
**including an unknown or malformed flag, or two scope flags at once** — fail-closed, never
reported as clean.

## Lint rules

| Rule | Trigger |
|---|---|
| `no-hardcoded-hex` | Always. |
| `no-off-scale-spacing` | Always. |
| `no-unknown-component` | Always. |
| `no-literal-jsx-string` | Only when `manifest.i18n.enabled === true`. |

## Deprecated

- `guard` → `enforce` — removed in 0.4.0
- `patrol` → `check` — removed in 0.4.0

Use `enforce` and `check`.

---

## Para agentes em português

Este arquivo é o que qualquer agente lê para saber o que o Steve faz — o `help` imprime
este arquivo palavra por palavra. Resumo: o Steve tem três modos (Criação, Governança,
Direção) e oito comandos (`start`, `resume`, `enforce`, `check`, `build`, `handoff`,
`arsenal`, `help`). Roda em Claude Code, Kilo e Codex: as leis (`AGENTS.md`, `docs/design/`,
`design_lint`, pre-commit, CI) valem igual nos três; só a Criação degrada fora do Claude Code
(os plugins `frontend-design` e `ui-ux-pro-max` são exclusivos do Claude). Os aliases
`guard`/`patrol` foram removidos na 0.4.0 — use `enforce` e `check`.
Toda mudança de UI num projeto governado passa pelo Steve: peça o contrato via `handoff`
antes de escrever código, e rode `check` antes de commitar — isso vale mesmo para agentes
que nunca invocaram o plugin, porque o gate de lint roda no pre-commit e na CI
independentemente de quem escreveu o código.
