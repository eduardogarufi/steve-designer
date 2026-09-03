# Governance Playbook — Governance Mode

The operating model for steve-designer's **Governance mode**: how it enforces an existing design system, what it blocks versus warns about, what scopes it verifies, how it behaves per stack, and how to handle intentional exceptions.

---

## Purpose

Governance mode keeps an *existing* design system faithful during ongoing development — it is the enforcement counterpart to the six-phase Creation flow. Where Creation mode takes a blank page to a shipped identity, Governance mode defends that identity against drift and hallucination once the project already has tokens, primitives, and packages.

It works through three mechanisms, run in order. **INGEST** auto-detects the repo's stack and emits a machine-readable manifest at `docs/design/manifest.json` (tokens, components with real props, packages; legacy fallback `design-system-manifest.json` at the root). **CODIFY** turns that manifest into the portable law — the `docs/design/` documentation, an `AGENTS.md` contract, plus a `design-lint` ruleset wired into pre-commit and CI. **CHECK** enforces it continuously: the mechanical linter blocks violations at the git level, a PostToolUse hook catches them in-session, and the `design-enforcer` subagent reviews the semantic layer the linter cannot see.

---

## The portable-layer rule

Governance mode is built so the guarantee survives outside Claude Code. A Claude skill cannot run inside Codex, so the guarantee lives in git-level artifacts that any agent — or no agent — passes through. The manifest, `AGENTS.md`, `design-lint`, and the pre-commit + CI wiring are the actual enforcement; the skill, commands, hook, and subagent are a convenience layer that makes the same enforcement pleasant inside Claude Code and degrades gracefully everywhere else.

| Layer | Artifacts | Runs where | Role |
|-------|-----------|------------|------|
| **Portable (the guarantee)** | `docs/design/**` (manifest, design doc, contrast, screens, decisions, handoffs, capabilities), `AGENTS.md`, `scripts/design_lint.mjs`, pre-commit hook, CI workflow | Git / any agent / CI — Claude **and** Codex | Blocks non-conforming code regardless of who wrote it |
| **Convenience (Claude-side)** | This skill, `/steve-designer:enforce`, `/steve-designer:check`, `/steve-designer:build`, `/steve-designer:handoff`, `hooks/design-lint-hook.sh`, `agents/design-enforcer.md`, `agents/design-critic.md` | Claude Code only | Sets up the portable layer, catches violations in-session, adds semantic review |

The test of the design: if you deleted the entire Claude convenience layer, the pre-commit hook and CI check would still block a hardcoded hex pushed from Codex. That is the point.

---

## Severity model

Two severities, two destinations.

- **`error` — blocks.** Mechanical, unambiguous violations the linter can prove from the manifest: hardcoded hex not in the token system, off-scale spacing, importing a component that is not in the inventory whitelist, and (via the semantic reviewer) a prop passed to a component that the manifest says does not exist. Errors fail pre-commit and CI. The build does not advance until they are fixed.
- **`warning` — surfaced, not blocked.** Semantic judgments that need design taste rather than a regex: a generic component used where a more specific one exists, or a token used outside its semantic role (an accent color pressed into a background, a motion token applied to the wrong interaction tier). Warnings are reported by the `design-enforcer` subagent during `check` only. They do not block the gate, because a false block on a judgment call erodes trust in the whole system.

The mechanical rules, all `error`:

| Rule | Severity | Active when |
|---|---|---|
| `no-hardcoded-hex` | error | always |
| `no-off-scale-spacing` | error | always |
| `no-unknown-component` | error | a component whitelist exists in the manifest |
| `no-literal-jsx-string` | error | only when `manifest.i18n.enabled === true` — gated so a project without i18n is never blocked for literal copy; there the `design-enforcer` reviews **voice** instead |

Errors are owned by `design_lint.mjs`. Warnings are owned by `design-enforcer`. The two never overlap: the subagent does not re-report what the linter already blocks.

---

## Scopes of `check`

`design_lint.mjs` owns a single scope resolver, and `check` passes the resolved `{files, diff}` to the enforcer and the critic so all three layers judge exactly the same change.

| Scope | Flag | Resolution |
|---|---|---|
| Working tree | (default, `--changed`) | Staged + unstaged + untracked. |
| Commit | `--commit <sha>` | The diff that commit introduced (root commits handled). |
| Range | `--range <a>..<b>` | The literal `a..b` diff. |
| Pull request | `--pr <n>` | `baseRefOid`/`headRefOid` via `gh pr view`; local `HEAD` must equal the PR head. |

The flags are mutually exclusive. **Fail closed:** a git error, an invalid revision, a `HEAD` that does not match the PR head, an unknown or malformed flag, or a missing/unauthenticated `gh` exits non-zero (`2` = configuration or scope failure) and is reported as a failure. A scope that cannot be resolved is never reported as clean — that is the whole point of the gate.

`check` resolves the scope **once**, via `node scripts/design_lint.mjs <scope-flag> --emit-scope <path>`, and every later layer (`design-enforcer`, `design-critic`) reads that snapshot's `{files, diff}` instead of running its own `git diff`. `check` first confirms `node scripts/design_lint.mjs --version` is `0.3.0` or newer — a stale vendored linter cannot honor `--emit-scope`, so `check` refuses to proceed until the repo re-runs `enforce`.

**Manifest override policy:** explicit `--manifest` wins; otherwise `docs/design/manifest.json`, then legacy root; both present = stop and run `enforce` to migrate.

---

## False positives

Sometimes a flagged value is intentional. There are two ways to make peace with the gate.

1. **Promote it into the system (preferred).** If you genuinely need a color, add it to `tokens.color` and re-run INGEST so it lands in `allowedHex`. If you need a spacing value, add it as a scale step. This keeps the manifest as the single source of truth — the exception becomes part of the documented system rather than an escape from it. The same applies to a component the inventory does not yet have: build it into the design system, then re-run `/steve-designer:enforce` (or `ingest_design_system.py`) so it joins the whitelist.

2. **The inline escape hatch (future — out of scope for v1).** A planned mechanism is a `// design-lint-allow <rule>` line comment that the linter would skip for that line, for the rare case where promotion is wrong (e.g. a one-off third-party embed). This is documented here as a deliberate future escape hatch; it is **not** implemented in v1. For now, the answer to a real false positive is promotion into the token system, and the answer to a *correct* flag is to fix the code.

---

## Stack-by-stack behavior

INGEST classifies the repo into one of several stacks, and that classification decides which rules have teeth.

- **shadcn** — a `components.json` is present. Full component whitelist: the inventory is built from the `components/ui` directory, so the no-unknown-component rule is live alongside tokens and spacing. All three mechanical rules enforce.
- **own-primitives** — no `components.json`, but the repo ships its own component directory (`components/` or `src/components/`) with `.tsx`/`.jsx` exports. The whitelist is derived from that directory. The no-unknown-component rule enforces against the project's own primitives; tokens and spacing enforce as normal.
- **token-css** — a token-based system (CSS custom properties / a `tokens.ts`) with **no Tailwind**. `tailwind` is `false`; the type is never `tailwind-css` in this case (that contradiction was a bug). If the design system is a workspace package (e.g. `@scope/ui`) the whitelist is derived from its real exports and the no-unknown-component rule enforces against package imports (`@scope/ui`, `@scope/ui/*`).
- **tailwind-css** — real Tailwind (the `tailwindcss` dependency, a `tailwind.config.*`, or a CSS `@import "tailwindcss"`). If there is no component whitelist to derive, the no-unknown-component rule is **inert** (it only fires when a whitelist exists), so enforcement is tokens + spacing only. `enforce` says this out loud at setup.
- **css-modules** — no Tailwind, no tokens, no component library detected. Only the rules with data enforce.

---

## Brownfield & configuration

Governance mode must adapt to a **running** project, not just a greenfield one. Two mechanisms make that possible.

**Configurable DS sources.** By default INGEST auto-detects the design system by scanning `package.json` workspaces for a package whose `exports` map points at `.tsx` files (a component library like `@vinci/ui`) and by looking for the `components/ui/` convention. When auto-detection is wrong or the DS lives somewhere unusual, declare it explicitly in a `steve.config.json` at the repo root (or a `steveDesigner` field in `package.json`):

```json
{ "dsSources": [ { "dir": "packages/ui/src/**", "package": "@scope/ui" } ] }
```

Each source has a `dir` (glob to scan for component files) and/or a `package` (the import specifier used for those components). Components are extracted from real exports (`export function|const <PascalCase>`), and the linter's import matcher is emitted into the manifest as `dsImportPrefixes` (e.g. `["@scope/ui", "@scope/ui/*"]`), so `no-unknown-component` works against package imports, not only `components/ui/` paths.

**Non-destructive enforce.** On a repo that already has an `AGENTS.md`, a customized `scripts/design_lint.mjs`, or a hand-tuned manifest whitelist, `enforce` **merges or skips** — it never overwrites the constitution. It detects brownfield, preserves existing entries, appends rather than replaces, and reports every create/merge/skip decision. The manifest merge preserves human-added components, tokens, and `allowedHex` that the detector didn't find.

**Atomic migration.** Before INGEST runs, `enforce` resolves any legacy-vs-`docs/design/` split for the manifest and the brief: a legacy-only file is `git mv`'d into place, a `docs/design/`-only file is left alone, and **both present is a stop** — `enforce` shows the diff and asks the user to choose rather than silently picking one or leaving both around. `enforce` also copies `skills/steve-designer/references/capabilities.md` to `docs/design/capabilities.md` so any agent in the project can read Steve's capability map without the plugin, and offers to replace a vendored `scripts/design_lint.mjs` that reports below `design-lint 0.3.0` (missing `--version`, `--emit-scope`, or fail-closed flag parsing) — since `check` will not work correctly against it.

---

## Operating cadence

- **`enforce` — once per repo.** Run `/steve-designer:enforce` a single time to set up: INGEST the design system, generate `docs/design/`, CODIFY the `AGENTS.md` law, install the pre-commit hook and CI workflow, and configure the (≤3) MCP servers for Claude and Codex. Re-run only when the design system itself changes (new tokens, new components) so the manifest stays current.
- **hook + pre-commit + CI — continuously, automatically.** The PostToolUse hook catches violations while Claude is editing; the pre-commit hook blocks a bad commit locally; CI blocks a bad PR. These run without anyone invoking them and cover code from any agent.
- **`check` — before PRs, and after any executor.** Run `/steve-designer:check` on the change before opening a pull request: the mechanical lint (blocking), the `design-enforcer` semantic review (severity-rated), and the `design-critic` visual pass when a preview exists or `--visual` is passed. This is the deliberate, human-in-the-loop checkpoint on top of the automatic gates — and it is how Direction mode closes the loop on work done by `build` or by an external executor from a `handoff` contract.
