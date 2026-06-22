# Steve Designer — Sheriff Mode (Design System Enforcement)

**Date:** 2026-06-23
**Status:** Design approved, pending spec review → implementation plan
**Author:** steve-designer + Eduardo Garufi

---

## Problem

Steve Designer today is a *birth* tool: its six phases (Arsenal → Discovery → References → Tokens → Build → Polish) all assume you are *creating* a new design system from a blank page. It has almost no machinery for the problem that actually hurts day to day:

> Once the design system, the primitives and the packages exist, ongoing development drifts away from them. Agents hallucinate — they don't use the existing components, invent props that never existed, hardcode hex values, and ignore the token system.

The existing "fidelity" mechanisms are all weak or late:

- The `claude-md-snippet` template is a passive reminder ("don't hardcode") — text, not a verifiable contract. It never lists which components exist or which are forbidden.
- `component-builder` has strong anti-hardcode rules, but they only fire when Phase 5 is explicitly invoked. The hundreds of commits of normal development never pass through it.
- `design-critic` is visual taste, post-hoc, manual, Phase 6 only.
- Nothing feeds the agent the **real component inventory and props** — the root cause of hallucination.
- There is no automated gate (lint / grep / CI) that *fails* when someone hardcodes a value or uses a component that does not exist.

## Goal

Add a standalone **Sheriff Mode** to Steve Designer that keeps ongoing development faithful to a design system that *already exists*, and make Steve the responsible agent whenever UI is touched — **in both Claude Code and Codex**.

### Decisions locked during brainstorming

1. **Shape:** a new standalone *Governance Mode*, invocable on any repo that already has a DS — coexists with the creation flow but does not require it.
2. **Stack:** must **auto-detect per repo** (shadcn/ui+Tailwind, own primitives/wrappers, pure Tailwind+CSS tokens — varies across Traidon, Elyra, Vinci, garufi.net, Polymarket). No single stack assumed.
3. **Gate strength:** **hard automated gate** — generates lint rules + a check that runs in pre-commit/CI and *fails the build*. The agent-review layer comes nearly for free (ingestion must read the DS into context anyway) and acts as the semantic second line, but mechanical blocking is the guarantee.
4. **Steve in the dev loop:** Steve is the responsible agent when UI is touched, not only a setup step + final gate.
5. **Cross-tool (Claude + Codex):** the fidelity guarantee must live in **tool-agnostic artifacts**, because a Claude skill cannot run inside Codex.

## Core architectural insight: the portable layer

Skills, slash commands and subagents are **Claude Code only**. The guarantee therefore cannot depend on Steve-as-skill. It lives in tool-agnostic artifacts that both agents honor:

| Layer | Artifact | Claude Code | Codex | Guarantee |
|---|---|---|---|---|
| The law | `AGENTS.md` at repo root (CLAUDE.md includes/points to it) | reads | reads natively | Living context + rules for both |
| Living context | `design-system-manifest.json`, referenced from `AGENTS.md` | yes | yes | Real inventory → kills hallucination in both |
| Required MCPs | `guard` writes `.mcp.json` **and** `~/.codex/config.toml` | yes | yes | The ≤3 servers configured for both |
| The hard gate | `design-lint` + pre-commit hook + CI workflow | yes | yes | Runs **regardless of which tool wrote the code** |

**The bottom row is the key:** the pre-commit + CI check is git-level, so it fires no matter which agent generated the diff. That is what actually holds Codex faithful. The Claude skill / slash commands / subagent / hook are a **convenience (better DX) layer** that degrades gracefully to "AGENTS.md + lint" under Codex.

## The three mechanisms: INGEST → CODIFY → PATROL

### 1. INGEST — living context (kills hallucination)

Auto-detect the repo's stack and produce `design-system-manifest.json`:

- **Tokens:** every color/spacing/radius/shadow/motion token name + value, read from the real token source (CSS variables, `design-tokens.ts`, `tailwind.config`, etc.).
- **Components:** the real inventory of primitives/wrappers **with their actual props** (name, type, required/optional). This is the antidote to "invented a prop that never existed."
- **Packages:** allowed packages + the versions actually installed (from `package.json` / lockfile), so the gate can reject off-version API usage and Context7 can resolve correct docs.

Stack auto-detection probes, in order: shadcn (`components.json`) → known component dir conventions (`components/ui`, `src/components`) → token files → Tailwind config → fallback to "pure Tailwind/CSS tokens" (enforcement focuses on tokens + banned patterns, no component whitelist).

### 2. CODIFY — the versioned law

From the manifest, generate two artifacts:

- **`AGENTS.md`** (the portable law) + a CLAUDE.md include/pointer. Contains: component whitelist, allowed tokens, banned patterns (hardcoded hex, off-scale spacing, purple→pink gradients, Inter-without-display, etc.), and a pointer to the manifest for the full inventory. Versioned and reviewable — the research's explicit recommendation over an opinionated MCP "memory" server.
- **The automated ruleset:** ESLint/Stylelint config + a `design-lint` script that fails on: hardcoded hex, spacing off the scale, import of a component outside the whitelist, and (later) props not present on a component. Plus a pre-commit hook and a CI workflow snippet that run it.

### 3. PATROL — the hard gate

- The automated check runs in pre-commit/CI and **blocks** on violations.
- A `design-enforcer` subagent (Claude side) covers what the linter cannot: semantics — "you used `Card` but should have used `StatusCard`." It reports severity (Critical/High/Nice-to-have) but the mechanical block is the guarantee.

## Steve in the development loop

So Steve is "responsible when you touch UI":

- **Claude Code:** a **hook** on `Edit`/`Write` over UI globs (`*.tsx`, `*.css`, component dirs) that runs the *fast* `design-lint` only — **silent on pass, speaks only on failure** (zero noise in the normal case) — and keeps the manifest in context so whoever writes UI already has the real inventory.
- **Faithful by construction:** with manifest + AGENTS.md always in context, the agent writes *using components that exist* instead of inventing. The hard gate is the safety net, not the first line.
- **Codex:** same AGENTS.md + manifest + the MCPs from `config.toml` + the same pre-commit. No native hook equivalent, so the pre-commit covers it.

## Resolving tool-bloat (research asks for ≤3 MCPs)

The current `arsenal.md` lists ~10 MCPs/plugins, against the "3–5 max, start with 2–3" recommendation. Re-tier `arsenal.md` into **creation arsenal** vs **governance arsenal**. In Sheriff Mode, at most 3 are active per repo:

1. **Stack-aware DS source:** shadcn MCP + private registry **if** the repo is shadcn; otherwise direct read of the component directory (no new MCP for own primitives).
2. **Context7** (already present) — correct package APIs.
3. **Visual verifier** (Playwright / Chrome DevTools, already present) — the "see what was built" loop.

## Implementation surface

### New files

- `commands/guard.md` — one-time setup on a repo: runs INGEST + CODIFY, writes AGENTS.md, installs the hook, writes both MCP configs, installs pre-commit + CI.
- `commands/patrol.md` — on-demand enforcement run (the `design-enforcer` over a diff/PR).
- `agents/design-enforcer.md` — semantic review subagent (severity model, false-positive handling).
- `scripts/ingest_design_system.py` — auto-detect stack, emit `design-system-manifest.json`.
- `scripts/design_lint.mjs` — the stack-aware linter (hex/spacing/imports first; invented-props later).
- `templates/AGENTS.md.template.md` — the portable law.
- `templates/design-system-manifest.template.json` — manifest shape.
- `templates/mcp.json.template` + `templates/codex-config.toml.template` — the ≤3 MCPs for both agents.
- `templates/precommit-design.template` + `templates/ci-design-check.template.yml` — the hard gate wiring.
- `hooks/` — Claude Code hook (PostToolUse on UI globs → fast `design-lint` + manifest injection).
- `references/governance-playbook.md` — severity model, false-positive handling, how the sheriff operates.

### Changed files

- `skills/steve-designer/SKILL.md` — add Sheriff Mode + when to use governance vs creation.
- `skills/steve-designer/references/arsenal.md` — re-tier (creation vs governance), add tool-bloat note.
- `skills/steve-designer/references/orchestration-map.md` — add governance rows.
- `.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json` — register new commands + agent + hook.
- `CHANGELOG.md`.

## Out of scope (YAGNI)

- Full AST-based prop validation in v1 (grep/pattern-based first; AST only for invented-props later).
- Auto-fixing violations (the gate blocks and reports; the human/agent fixes).
- A hosted private registry service (use shadcn's existing registry mechanism when applicable; direct repo read otherwise).
- Visual regression baselines (the visual verifier is for the dev loop, not snapshot diffing — that can come later).

## Success criteria

1. Running `/steve-designer:guard` on a repo with an existing DS produces: a manifest, an AGENTS.md, working `.mcp.json` + `~/.codex/config.toml`, an installed pre-commit hook, and a CI workflow — auto-detecting that repo's stack.
2. A diff that hardcodes a hex value, uses off-scale spacing, or imports a non-whitelisted component **fails** the `design-lint` check in pre-commit and CI.
3. The same enforcement holds whether the offending code was written by Claude Code or Codex.
4. In a normal (clean) UI edit inside Claude Code, the hook is silent — no noise.
5. `/steve-designer:patrol` returns a severity-rated semantic review of a UI diff.
