# Governance Playbook — Sheriff Mode

The operating model for steve-designer's **Sheriff mode**: how it enforces an existing design system, what it blocks versus warns about, how it behaves per stack, and how to handle intentional exceptions.

---

## Purpose

Sheriff mode keeps an *existing* design system faithful during ongoing development — it is the enforcement counterpart to the six-phase creation flow. Where creation mode takes a blank page to a shipped identity, Sheriff mode defends that identity against drift and hallucination once the project already has tokens, primitives, and packages.

It works through three mechanisms, run in order. **INGEST** auto-detects the repo's stack and emits a machine-readable `design-system-manifest.json` (tokens, components with real props, packages). **CODIFY** turns that manifest into the portable law — an `AGENTS.md` contract plus a `design-lint` ruleset wired into pre-commit and CI. **PATROL** enforces it continuously: the mechanical linter blocks violations at the git level, a PostToolUse hook catches them in-session, and the `design-enforcer` subagent reviews the semantic layer the linter cannot see.

---

## The portable-layer rule

Sheriff mode is built so the guarantee survives outside Claude Code. A Claude skill cannot run inside Codex, so the guarantee lives in git-level artifacts that any agent — or no agent — passes through. The manifest, `AGENTS.md`, `design-lint`, and the pre-commit + CI wiring are the actual enforcement; the skill, commands, hook, and subagent are a convenience layer that makes the same enforcement pleasant inside Claude Code and degrades gracefully everywhere else.

| Layer | Artifacts | Runs where | Role |
|-------|-----------|------------|------|
| **Portable (the guarantee)** | `design-system-manifest.json`, `AGENTS.md`, `scripts/design_lint.mjs`, pre-commit hook, CI workflow | Git / any agent / CI — Claude **and** Codex | Blocks non-conforming code regardless of who wrote it |
| **Convenience (Claude-side)** | This skill, `/steve-designer:guard`, `/steve-designer:patrol`, `hooks/design-lint-hook.sh`, `agents/design-enforcer.md` | Claude Code only | Sets up the portable layer, catches violations in-session, adds semantic review |

The test of the design: if you deleted the entire Claude convenience layer, the pre-commit hook and CI check would still block a hardcoded hex pushed from Codex. That is the point.

---

## Severity model

Two severities, two destinations.

- **`error` — blocks.** Mechanical, unambiguous violations the linter can prove from the manifest: hardcoded hex not in the token system, off-scale spacing, importing a component that is not in the inventory whitelist, and (via the semantic reviewer) a prop passed to a component that the manifest says does not exist. Errors fail pre-commit and CI. The build does not advance until they are fixed.
- **`warning` — surfaced, not blocked.** Semantic judgments that need design taste rather than a regex: a generic component used where a more specific one exists, or a token used outside its semantic role (an accent color pressed into a background, a motion token applied to the wrong interaction tier). Warnings are reported by the `design-enforcer` subagent during `patrol` only. They do not block the gate, because a false block on a judgment call erodes trust in the whole system.

Errors are owned by `design_lint.mjs`. Warnings are owned by `design-enforcer`. The two never overlap: the subagent does not re-report what the linter already blocks.

---

## False positives

Sometimes a flagged value is intentional. There are two ways to make peace with the gate.

1. **Promote it into the system (preferred).** If you genuinely need a color, add it to `tokens.color` and re-run INGEST so it lands in `allowedHex`. If you need a spacing value, add it as a scale step. This keeps the manifest as the single source of truth — the exception becomes part of the documented system rather than an escape from it. The same applies to a component the inventory does not yet have: build it into the design system, then re-run `/steve-designer:guard` (or `ingest_design_system.py`) so it joins the whitelist.

2. **The inline escape hatch (future — out of scope for v1).** A planned mechanism is a `// design-lint-allow <rule>` line comment that the linter would skip for that line, for the rare case where promotion is wrong (e.g. a one-off third-party embed). This is documented here as a deliberate future escape hatch; it is **not** implemented in v1. For now, the answer to a real false positive is promotion into the token system, and the answer to a *correct* flag is to fix the code.

---

## Stack-by-stack behavior

INGEST classifies the repo into one of three stacks, and that classification decides which rules have teeth.

- **shadcn** — a `components.json` is present. Full component whitelist: the inventory is built from the `components/ui` directory, so the no-unknown-component rule is live alongside tokens and spacing. All three mechanical rules enforce.
- **own-primitives** — no `components.json`, but the repo ships its own component directory (`components/` or `src/components/`) with `.tsx`/`.jsx` exports. The whitelist is derived from that directory. The no-unknown-component rule enforces against the project's own primitives; tokens and spacing enforce as normal.
- **tailwind-css** — Tailwind with CSS-variable tokens but no component whitelist to derive. The no-unknown-component rule is **inert** (it only fires when a whitelist exists), so enforcement is tokens + spacing only. `guard` says this out loud at setup so the absence of component blocking is expected, not a silent gap.

---

## Operating cadence

- **`guard` — once per repo.** Run `/steve-designer:guard` a single time to set up: INGEST the design system, CODIFY the `AGENTS.md` law, install the pre-commit hook and CI workflow, and configure the (≤3) MCP servers for Claude and Codex. Re-run only when the design system itself changes (new tokens, new components) so the manifest stays current.
- **hook + pre-commit + CI — continuously, automatically.** The PostToolUse hook catches violations while Claude is editing; the pre-commit hook blocks a bad commit locally; CI blocks a bad PR. These run without anyone invoking them and cover code from any agent.
- **`patrol` — before PRs.** Run `/steve-designer:patrol` on the current diff before opening a pull request: the mechanical lint (blocking) plus the `design-enforcer` semantic review (severity-rated). This is the deliberate, human-in-the-loop checkpoint on top of the automatic gates.
