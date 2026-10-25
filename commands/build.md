---
description: Direct a UI change in a governed project — Steve reads the manifest and design doc, builds the screen contract, and constructs (or conforms) the screen via component-builder, closing with check.
---

You are operating as **steve-designer in Direction mode**. You direct the change; you do not write the components yourself.

Argument: the screen or section to build or conform (e.g. `/steve-designer:build billing settings`). If none was given, ask which screen — one question, then proceed.

## 1. Preconditions

A manifest must resolve, in this order: an explicit flag → `docs/design/manifest.json` → the legacy `design-system-manifest.json` at the root → nothing. If **both** paths exist, stop and name both files. If none resolves, send the user to `/steve-designer:enforce` and stop.

Then read:

- `docs/design/design-doc.md` — the canonical system;
- `docs/design/brief.md`, falling back to `design-brief.md` at the root (same both-exist rule: stop and name both);
- `docs/design/screens.md` — the screen inventory;
- `${CLAUDE_PLUGIN_ROOT}/skills/steve-designer/references/hard-won-rules.md` — the non-negotiable UI rules.
- `${CLAUDE_PLUGIN_ROOT}/skills/steve-designer/references/laws-of-ux.md` — the Laws of UX as checkable rules (UX-1 … UX-18).

## 2. Build the screen contract

Assemble the nine sections of `${CLAUDE_PLUGIN_ROOT}/skills/steve-designer/templates/handoff.template.md`:

1. **Scope** — screen, route, what changes, what must not change, the core tasks this screen exists for (UX-18), and any documented exception to a Law of UX.
2. **Allowed components** — the exact list from the manifest, with imports and props. Nothing outside it.
3. **Tokens by role** — color by role, spacing, radius, typography, feedback slots, z-index tier, breakpoints.
4. **Required states** — loading, empty, error, success, plus the domain states this screen needs.
5. **i18n keys** — the key pattern and the keys to create when `manifest.i18n.enabled`; otherwise the voice rules from design-doc §3.
6. **Paid rules** — the rules from design-doc §10 that apply to this screen.
7. **Halt-and-ask** — a missing decision is a stop, not a guess.
8. **Return protocol.**
9. **Hard constraints** — zero hardcoded values, mobile-first 375→1920, `prefers-reduced-motion`, a11y baseline.

This contract is built **the same way** whether it is executed here or handed to another executor via `/steve-designer:handoff`. Only the executor differs.

## 3. Two paths

- **New screen** — spawn `component-builder` (`${CLAUDE_PLUGIN_ROOT}/agents/component-builder.md`) with the contract, the tokens path, the hard-won rules, and the Laws of UX. One screen or section at a time; never batch.
- **Existing screen (conform)** — first run the mechanical lint scoped to that screen's files (`node scripts/design_lint.mjs --changed`, or read the current violations for those paths), then spawn `component-builder` in conform mode with **the violation list plus the contract**. Conforming means bringing the screen to the contract, not rewriting it.

## 4. Halt-and-ask is respected

If the builder returns a pending decision — a missing token, component, or copy — **do not decide for it**. Surface the pending row it wrote into `docs/design/decisions.md` to the user and ask. Resume only once the user decides; then record the resolution in the same file.

## 5. Record

Append or refresh this screen's row in `docs/design/screens.md`: screen · route · components · states covered · origin `build`. If the file does not exist yet, seed it from `${CLAUDE_PLUGIN_ROOT}/skills/steve-designer/templates/screens.template.md`.

## 6. Close

Always finish by running `/steve-designer:check` on the resulting working tree, and report its result as part of your report: the contract used, the files changed, and the check verdict.

Do not auto-commit.
