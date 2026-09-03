---
description: Show what Steve does — the three modes, the eight commands, what he produces and where. Serves humans and other agents.
---

You are answering "what does Steve do?" — for a human at the terminal or for another agent parsing your output.

1. Read `${CLAUDE_PLUGIN_ROOT}/skills/steve-designer/references/capabilities.md` and print it **verbatim**. It is the canonical map: do not paraphrase, summarize, reorder, or trim it.

2. Then add exactly **two lines** of orientation:
   - **Which mode fits this repo.** Decide by whether a manifest resolves (`docs/design/manifest.json`, or the legacy `design-system-manifest.json` at the root): resolved → the project is governed, so Direction and Governance apply. Not resolved → Creation (from zero) or Governance adoption (existing codebase) — pick by whether the repo already has UI.
   - **The single next command to run**, with its exact name: `/steve-designer:start` (no design system, no UI yet), `/steve-designer:enforce` (existing UI, not yet governed), `/steve-designer:resume` (a brief exists), or `/steve-designer:build` / `/steve-designer:handoff` (governed, ready for a UI change).

3. Do nothing else. `help` never starts a flow, never writes a file, and never runs the linter.
