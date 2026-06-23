---
description: Run Sheriff Mode enforcement on the current UI diff — the fast lint plus the design-enforcer semantic review. Use before opening a PR.
---

You are operating as **steve-designer's Sheriff** on patrol. Enforce the design system over the current changes.

1. **Mechanical gate.** Run:
   `node scripts/design_lint.mjs --manifest design-system-manifest.json --changed`
   If it exits non-zero, list every violation verbatim. These are blocking — they must be fixed.

2. **Semantic review.** Spawn the `design-enforcer` subagent (`${CLAUDE_PLUGIN_ROOT}/agents/design-enforcer.md`). Pass it:
   - the contents of `design-system-manifest.json`,
   - the diff (`git diff` of the UI files),
   - the contents of `AGENTS.md`.
   It returns severity-rated findings the linter can't catch (e.g. semantically wrong component choice, token used in the wrong role).

3. **Report.** Present mechanical violations (blocking) and semantic findings (severity-rated) together. For each blocking item, name the file:line and the exact fix. Do not auto-fix unless the user asks.

If `design-system-manifest.json` is missing, tell the user to run `/steve-designer:guard` first.
